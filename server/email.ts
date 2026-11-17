import net, { isIP } from 'node:net';
import tls from 'node:tls';
import { createInterface } from 'node:readline';

export class EmailConfigurationError extends Error {}

function getEmailConfig() {
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT?.trim() || '465');
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS?.replace(/\s/g, '');
  const from = process.env.SMTP_FROM?.trim() || user;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port.');
  }
  if (!user || !password || !from) {
    throw new EmailConfigurationError('Set SMTP_USER and SMTP_PASS (or RESEND_API_KEY) in Secrets to enable password reset email.');
  }

  const mailboxPattern = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
  if (!mailboxPattern.test(user) || !mailboxPattern.test(from)) {
    throw new Error('SMTP_USER and SMTP_FROM must be email addresses.');
  }

  return { host, port, user, password, from };
}

async function sendViaResend(to: string, code: string, apiKey: string): Promise<void> {
  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || 'Digital Library <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Digital Library password reset OTP',
      text: [
        'Your Digital Library password reset OTP is:',
        '',
        code,
        '',
        'This OTP expires in 15 minutes. If you did not request a password reset, you can ignore this email.'
      ].join('\n')
    })
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Resend API error (${res.status}): ${errText}`);
  }
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(to)) {
    throw new Error('The password reset recipient is not a valid email address.');
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey && (!process.env.SMTP_USER?.trim() || !process.env.SMTP_PASS?.trim())) {
    await sendViaResend(to, code, resendKey);
    return;
  }

  const config = getEmailConfig();
  const useStartTls = config.port === 587;

  let socket: net.Socket | tls.TLSSocket = useStartTls
    ? net.connect({ host: config.host, port: config.port })
    : tls.connect({
        host: config.host,
        port: config.port,
        ...(isIP(config.host) ? {} : { servername: config.host })
      });

  socket.setTimeout(20000, () => socket.destroy(new Error('SMTP connection timed out.')));

  await new Promise<void>((resolve, reject) => {
    socket.once(useStartTls ? 'connect' : 'secureConnect', resolve);
    socket.once('error', reject);
  });

  let reader = createInterface({ input: socket, crlfDelay: Infinity });
  let responseLines = reader[Symbol.asyncIterator]();

  const readResponse = async () => {
    const firstLine = await responseLines.next();
    if (firstLine.done) throw new Error('SMTP server closed the connection.');

    const firstMatch = /^(\d{3})([ -])/.exec(firstLine.value);
    if (!firstMatch) throw new Error('SMTP server returned an invalid response.');

    const resCode = Number(firstMatch[1]);
    const lines = [firstLine.value];
    let continuation = firstMatch[2] === '-';

    while (continuation) {
      const nextLine = await responseLines.next();
      if (nextLine.done) throw new Error('SMTP server closed the connection.');
      lines.push(nextLine.value);

      const match = /^(\d{3})([ -])/.exec(nextLine.value);
      if (!match || Number(match[1]) !== resCode) {
        throw new Error('SMTP server returned an invalid multiline response.');
      }
      continuation = match[2] === '-';
    }

    return { code: resCode, lines };
  };

  const expectResponse = async (expectedCode: number, context: string) => {
    const response = await readResponse();
    if (response.code !== expectedCode) {
      throw new Error(`SMTP ${context} failed (${response.code}).`);
    }
  };

  const command = async (value: string, expectedCode: number, context: string) => {
    socket.write(`${value}\r\n`);
    await expectResponse(expectedCode, context);
  };

  try {
    await expectResponse(220, 'connection');
    await command('EHLO bookbridge.local', 250, 'greeting');

    if (useStartTls) {
      await command('STARTTLS', 220, 'STARTTLS');
      reader.close();
      socket = tls.connect({
        socket,
        ...(isIP(config.host) ? {} : { servername: config.host })
      });
      socket.setTimeout(20000, () => socket.destroy(new Error('SMTP TLS connection timed out.')));
      await new Promise<void>((resolve, reject) => {
        socket.once('secureConnect', resolve);
        socket.once('error', reject);
      });
      reader = createInterface({ input: socket, crlfDelay: Infinity });
      responseLines = reader[Symbol.asyncIterator]();
      await command('EHLO bookbridge.local', 250, 'TLS greeting');
    }

    await command('AUTH LOGIN', 334, 'authentication');
    await command(Buffer.from(config.user).toString('base64'), 334, 'username');
    await command(Buffer.from(config.password).toString('base64'), 235, 'password');
    await command(`MAIL FROM:<${config.from}>`, 250, 'sender');
    await command(`RCPT TO:<${to}>`, 250, 'recipient');
    await command('DATA', 354, 'message setup');

    const body = [
      'Your Digital Library password reset OTP is:',
      '',
      code,
      '',
      'This OTP expires in 15 minutes. If you did not request a password reset, you can ignore this email.'
    ].join('\r\n');
    const message = [
      `From: Digital Library <${config.from}>`,
      `To: <${to}>`,
      'Subject: Digital Library password reset OTP',
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      body
    ].join('\r\n').replace(/(^|\r\n)\./g, '$1..');
    socket.write(`${message}\r\n.\r\n`);
    await expectResponse(250, 'message delivery');
    await command('QUIT', 221, 'disconnect');
  } catch (error) {
    socket.destroy();
    throw error;
  } finally {
    reader.close();
    if (!socket.destroyed) socket.end();
  }
}
