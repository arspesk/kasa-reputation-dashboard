export interface Hotel {
  id: string;
  user_id: string;
  name: string;
  city: string;
  website_url: string | null;
  created_at: string;
}

export interface CreateHotelInput {
  name: string;
  city: string;
  website_url?: string;
}
