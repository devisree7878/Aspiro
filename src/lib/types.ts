export type Status = 'draft' | 'published' | 'archived'
export interface Profile {
  id: string; email: string; full_name: string
  institution: string | null; degree: string | null; branch: string | null
  graduation_year: number | null; location: string | null
  experience_level: 'beginner' | 'intermediate' | 'advanced' | null
  languages: string[]; tech_skills: string[]
  resume_path: string | null; github_url: string | null; linkedin_url: string | null
  objectives: string[]; preferred_location: string | null
  work_mode: 'remote' | 'hybrid' | 'onsite' | 'any' | null
  willing_to_relocate: boolean | null; company_type: string | null
  target_days: number | null; daily_minutes: number | null
  notifications_enabled: boolean; onboarding_completed: boolean; status: 'active' | 'suspended'
}
export interface Activity {
  id: string; day_id: string; type: string; title: string; description: string | null
  order_index: number; is_required: boolean; estimated_minutes: number
  status: Status; content: Record<string, any>; version: number
}
export interface Day {
  id: string; course_id: string; phase_id: string; day_number: number
  title: string; description: string | null; estimated_minutes: number; status: Status
}
export interface Progress {
  activity_id: string; status: 'in_progress' | 'completed'; score: number | null
  attempts: number; completed_at: string | null; result: any
}
