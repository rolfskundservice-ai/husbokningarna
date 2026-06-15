import { Role, BookingSource, BookingStatus } from "@prisma/client";

export type { Role, BookingSource, BookingStatus };

export interface PropertyDTO {
  id: string;
  name: string;
  description: string | null;
  color: string;
  airbnbIcalUrl: string | null;
  lastSyncedAt: string | null;
}

export interface BookingDTO {
  id: string;
  propertyId: string;
  userId: string | null;
  userName: string | null;
  startDate: string; // ISO date
  endDate: string; // ISO date
  guestName: string | null;
  notes: string | null;
  source: BookingSource;
  status: BookingStatus;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
    };
  }
}
