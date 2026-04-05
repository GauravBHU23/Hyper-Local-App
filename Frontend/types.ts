import type { ReactNode } from "react";

export type ServiceCategory =
  | "plumber"
  | "electrician"
  | "ac_repair"
  | "carpenter"
  | "cleaning"
  | "tutor"
  | "doctor"
  | "mechanic"
  | "chemist"
  | "hospital"
  | "grocery"
  | "salon"
  | "pest_control"
  | "painter"
  | "other";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  preferred_language?: string;
  profile_image?: string;
  is_provider?: boolean;
  is_admin?: boolean;
  created_at?: string;
}

export interface ServiceProvider {
  id: string;
  business_name: string;
  category: ServiceCategory;
  description?: string;
  address?: string;
  city?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  whatsapp?: string;
  rating: number;
  total_reviews: number;
  total_bookings: number;
  response_time_minutes: number;
  distance_km?: number;
  is_verified: boolean;
  is_currently_available: boolean;
  is_available_24x7: boolean;
  base_price?: number;
  price_unit?: string;
  images?: string[];
}

export interface Booking {
  id: string;
  provider_id: string;
  status: BookingStatus;
  problem_description: string;
  created_at?: string;
  service_address?: string;
  service_latitude?: number;
  service_longitude?: number;
  scheduled_at?: string;
  estimated_cost?: number;
  final_cost?: number;
  notes?: string;
  ai_suggested?: boolean;
  has_review?: boolean;
  service_otp?: string;
  user?: User;
  provider?: ServiceProvider;
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  is_verified_purchase?: boolean;
  user?: User;
}

export interface ChatResponse {
  reply: string;
  session_token: string;
  suggested_services?: ServiceProvider[];
  estimated_cost_range?: {
    min: number;
    max: number;
  };
  best_time_to_book?: string;
}

export interface AdminOverview {
  total_users: number;
  total_providers: number;
  total_bookings: number;
  pending_bookings: number;
  completed_bookings: number;
  flagged_reviews: number;
  pending_kyc_assets: number;
}

export interface ProviderEarningsStats {
  total_jobs: number;
  pending_jobs: number;
  completed_jobs: number;
  total_revenue: number;
  average_ticket_size: number;
}

export interface Payment {
  id: string;
  booking_id: string;
  user_id: string;
  provider_id: string;
  method: string;
  status: string;
  amount: number;
  gateway_reference?: string;
  gateway_name?: string;
  gateway_order_id?: string;
  gateway_key_id?: string;
  requires_confirmation?: boolean;
  gateway_status_message?: string;
  payment_instructions?: string;
  upi_id?: string;
  upi_name?: string;
  upi_link?: string;
  created_at: string;
}

export interface PaymentInvoice {
  payment: Payment;
  booking: Booking;
  customer: User;
  provider: ServiceProvider;
  invoice_number: string;
  issued_at: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  action_url?: string;
  is_read: boolean;
  created_at: string;
}

export interface MediaAsset {
  id: string;
  asset_type: string;
  file_url: string;
  original_name: string;
  is_verified: boolean;
  created_at: string;
  user?: User;
  provider?: ServiceProvider;
}

export interface SupportTicket {
  id: string;
  booking_id: string;
  user_id: string;
  provider_id: string;
  title: string;
  message: string;
  status: SupportTicketStatus;
  admin_notes?: string;
  created_at: string;
  booking?: Booking;
  user?: User;
  provider?: ServiceProvider;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details: Record<string, unknown>;
  created_at: string;
  user?: User;
}

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  plumber: "Plumber",
  electrician: "Electrician",
  ac_repair: "AC Repair",
  carpenter: "Carpenter",
  cleaning: "Cleaning",
  tutor: "Tutor",
  doctor: "Doctor",
  mechanic: "Mechanic",
  chemist: "Chemist",
  hospital: "Hospital",
  grocery: "Grocery",
  salon: "Salon",
  pest_control: "Pest Control",
  painter: "Painter",
  other: "Other",
};

export const CATEGORY_ICONS: Record<ServiceCategory, ReactNode> = {
  plumber: "P",
  electrician: "E",
  ac_repair: "AC",
  carpenter: "C",
  cleaning: "CL",
  tutor: "T",
  doctor: "D",
  mechanic: "M",
  chemist: "Rx",
  hospital: "H",
  grocery: "G",
  salon: "S",
  pest_control: "PC",
  painter: "PT",
  other: "O",
};
