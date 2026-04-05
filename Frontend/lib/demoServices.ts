import type { ServiceCategory, ServiceProvider } from "@/types";

type DemoTemplate = Omit<
  ServiceProvider,
  "id" | "distance_km" | "latitude" | "longitude"
> & {
  slug: string;
};

const DEMO_TEMPLATES: Array<
  DemoTemplate & { category: ServiceCategory; distance_km: number }
> = [
  {
    slug: "plumber-quickfix",
    category: "plumber",
    business_name: "QuickFix Plumbing",
    description: "Fast plumbing repairs for leaks, taps, and bathroom fittings.",
    address: "Near the main market",
    phone: "9876543210",
    whatsapp: "9876543210",
    rating: 4.6,
    total_reviews: 124,
    total_bookings: 310,
    response_time_minutes: 18,
    is_verified: true,
    is_currently_available: true,
    is_available_24x7: false,
    base_price: 249,
    price_unit: "per visit",
    distance_km: 1.8,
  },
  {
    slug: "electrician-sparkcare",
    category: "electrician",
    business_name: "SparkCare Electricians",
    description: "Wiring, switchboards, inverter issues, and emergency repairs.",
    address: "Residential service across nearby sectors",
    phone: "9876543211",
    whatsapp: "9876543211",
    rating: 4.5,
    total_reviews: 97,
    total_bookings: 255,
    response_time_minutes: 22,
    is_verified: true,
    is_currently_available: true,
    is_available_24x7: true,
    base_price: 299,
    price_unit: "per visit",
    distance_km: 2.4,
  },
  {
    slug: "acrepair-coolcare",
    category: "ac_repair",
    business_name: "CoolCare AC Repair",
    description: "Cooling issues, gas refill, servicing, and split AC repair.",
    address: "Available across the city",
    phone: "9876543212",
    whatsapp: "9876543212",
    rating: 4.7,
    total_reviews: 143,
    total_bookings: 402,
    response_time_minutes: 30,
    is_verified: true,
    is_currently_available: true,
    is_available_24x7: false,
    base_price: 399,
    price_unit: "starting",
    distance_km: 3.2,
  },
  {
    slug: "carpenter-woodworks",
    category: "carpenter",
    business_name: "Urban WoodWorks",
    description: "Furniture repair, custom shelves, and door fitting.",
    address: "Serving homes and offices nearby",
    phone: "9876543213",
    whatsapp: "9876543213",
    rating: 4.4,
    total_reviews: 76,
    total_bookings: 188,
    response_time_minutes: 35,
    is_verified: false,
    is_currently_available: true,
    is_available_24x7: false,
    base_price: 349,
    price_unit: "per visit",
    distance_km: 4.1,
  },
  {
    slug: "cleaning-homefresh",
    category: "cleaning",
    business_name: "HomeFresh Cleaning",
    description: "Home deep cleaning, kitchen cleaning, and sofa cleaning.",
    address: "Professional cleaning team nearby",
    phone: "9876543214",
    whatsapp: "9876543214",
    rating: 4.8,
    total_reviews: 201,
    total_bookings: 516,
    response_time_minutes: 28,
    is_verified: true,
    is_currently_available: true,
    is_available_24x7: false,
    base_price: 699,
    price_unit: "starting",
    distance_km: 2.9,
  },
  {
    slug: "tutor-smartlearn",
    category: "tutor",
    business_name: "SmartLearn Tutors",
    description: "Math, science, and language tutors for school students.",
    address: "Home and online tutoring available",
    phone: "9876543215",
    whatsapp: "9876543215",
    rating: 4.6,
    total_reviews: 88,
    total_bookings: 164,
    response_time_minutes: 40,
    is_verified: true,
    is_currently_available: true,
    is_available_24x7: false,
    base_price: 500,
    price_unit: "per session",
    distance_km: 5,
  },
  {
    slug: "doctor-familycare",
    category: "doctor",
    business_name: "FamilyCare Clinic",
    description: "General physician appointments and home visit consultation.",
    address: "Clinic available nearby",
    phone: "9876543216",
    whatsapp: "9876543216",
    rating: 4.5,
    total_reviews: 154,
    total_bookings: 290,
    response_time_minutes: 25,
    is_verified: true,
    is_currently_available: true,
    is_available_24x7: true,
    base_price: 600,
    price_unit: "consultation",
    distance_km: 3.7,
  },
  {
    slug: "mechanic-autofix",
    category: "mechanic",
    business_name: "AutoFix Mechanics",
    description: "Bike and car breakdown assistance with doorstep support.",
    address: "Roadside support across nearby localities",
    phone: "9876543217",
    whatsapp: "9876543217",
    rating: 4.3,
    total_reviews: 69,
    total_bookings: 140,
    response_time_minutes: 32,
    is_verified: false,
    is_currently_available: true,
    is_available_24x7: true,
    base_price: 350,
    price_unit: "starting",
    distance_km: 4.8,
  },
];

export function getDemoServices(): ServiceProvider[] {
  return DEMO_TEMPLATES.map((template) => ({
    id: `demo-${template.slug}`,
    ...template,
  }));
}

export function getDemoServicesByFilters(filters: {
  category?: ServiceCategory | null;
  query?: string;
  radiusKm?: number;
  minRating?: number;
  availableNow?: boolean;
}): ServiceProvider[] {
  const normalizedQuery = filters.query?.trim().toLowerCase();

  return getDemoServices().filter((provider) => {
    if (filters.category && provider.category !== filters.category) return false;
    if (filters.radiusKm && (provider.distance_km ?? Infinity) > filters.radiusKm) return false;
    if (filters.minRating && provider.rating < filters.minRating) return false;
    if (filters.availableNow && !provider.is_currently_available) return false;

    if (normalizedQuery) {
      const haystack = [
        provider.business_name,
        provider.description,
        provider.category,
        provider.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(normalizedQuery)) return false;
    }

    return true;
  });
}

export function getDemoServiceById(id: string): ServiceProvider | null {
  return getDemoServices().find((provider) => provider.id === id) ?? null;
}
