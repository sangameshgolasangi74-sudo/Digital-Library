export type UserRole = 'customer' | 'owner' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  can_customer: number;
  can_owner: number;
  phone: string;
  address: string;
  institution: string;
  bio: string;
  status: 'active' | 'suspended';
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  book_count?: number;
}

export interface DigitalChapter {
  title: string;
  paragraphs: string[];
}

export interface Book {
  id: number;
  owner_id: number;
  owner_name?: string;
  owner_institution?: string;
  category_id: number;
  category_name?: string;
  title: string;
  author: string;
  isbn: string;
  description: string;
  condition: 'New' | 'Like New' | 'Good' | 'Fair';
  price: number;
  borrow_fee: number;
  allow_buy: number;
  allow_exchange: number;
  allow_borrow: number;
  is_digital: number;
  digital_chapters?: DigitalChapter[];
  cover_url: string;
  stock: number;
  status: 'available' | 'reserved' | 'sold' | 'archived';
  rating_avg: number;
  rating_count: number;
  created_at: string;
}

export interface Order {
  id: number;
  buyer_id: number;
  buyer_name?: string;
  buyer_email?: string;
  owner_id: number;
  owner_name?: string;
  book_id: number;
  book_title?: string;
  book_author?: string;
  book_cover?: string;
  quantity: number;
  total_amount: number;
  payment_method: string;
  payment_status: 'paid' | 'pending' | 'refunded';
  order_status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shipping_name: string;
  shipping_address: string;
  shipping_phone: string;
  created_at: string;
}

export interface ExchangeRequest {
  id: number;
  requester_id: number;
  requester_name?: string;
  owner_id: number;
  owner_name?: string;
  requested_book_id: number;
  requested_book_title?: string;
  requested_book_cover?: string;
  offered_book_id: number | null;
  offered_title: string;
  offered_condition: string;
  note: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Borrowing {
  id: number;
  borrower_id: number;
  borrower_name?: string;
  owner_id: number;
  owner_name?: string;
  book_id: number;
  book_title?: string;
  book_cover?: string;
  duration_days: number;
  fee_amount: number;
  due_date: string;
  returned_at: string | null;
  status: 'pending' | 'active' | 'returned' | 'overdue' | 'rejected';
  created_at: string;
}

export interface Review {
  id: number;
  book_id: number;
  book_title?: string;
  user_id: number;
  user_name?: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Message {
  id: number;
  sender_id: number;
  sender_name?: string;
  receiver_id: number;
  receiver_name?: string;
  book_id: number | null;
  book_title?: string;
  body: string;
  is_read: number;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'order' | 'exchange' | 'borrow' | 'message' | 'system';
  is_read: number;
  created_at: string;
}

export interface Complaint {
  id: number;
  user_id: number | null;
  user_name?: string;
  user_email?: string;
  subject: string;
  details: string;
  status: 'open' | 'investigating' | 'resolved';
  admin_note: string;
  created_at: string;
}

export interface SiteSettings {
  site_name: string;
  support_email: string;
  support_phone: string;
  campus_hub_address: string;
  default_borrow_days: string;
  exchange_service_fee: string;
  announcement_banner: string;
}

export interface CartItem {
  book: Book;
  quantity: number;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: 'success' | 'error' | 'info';
}
