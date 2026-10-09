import { BookOpen, Code2, ListChecks, ClipboardList, Flag, Rocket, FileText, PlayCircle, ShieldCheck, type LucideIcon } from 'lucide-react'

export type FieldKind = 'md' | 'text' | 'number' | 'select' | 'lines'
export interface FieldDef { key: string; label: string; kind: FieldKind; options?: string[] }
export interface TypeDef { label: string; verb: string; icon: LucideIcon; defaultMinutes: number; fields: FieldDef[] }

const difficulty = ['easy', 'medium', 'hard']

/** UI registry only: it controls which editor/renderer a type uses. Content itself always lives in the database. */
export const ACTIVITY_TYPES: Record<string, TypeDef> = {
  lesson: { label: 'Lesson', verb: 'Learn', icon: BookOpen, defaultMinutes: 10, fields: [
    { key: 'body', label: 'Lesson content (Markdown: headings, code blocks, images, examples)', kind: 'md' },
    { key: 'resources', label: 'Resources (one per line: Label | https://url)', kind: 'lines' } ] },
  reading: { label: 'Reading', verb: 'Read', icon: FileText, defaultMinutes: 10, fields: [
    { key: 'body', label: 'Reading content (Markdown)', kind: 'md' },
    { key: 'source_url', label: 'Source URL (optional)', kind: 'text' } ] },
  video: { label: 'Video', verb: 'Watch', icon: PlayCircle, defaultMinutes: 10, fields: [
    { key: 'url', label: 'Video URL (YouTube or direct link)', kind: 'text' },
    { key: 'description', label: 'Notes shown under the video (Markdown)', kind: 'md' } ] },
  coding_exercise: { label: 'Coding Exercise', verb: 'Practice', icon: Code2, defaultMinutes: 20, fields: [] },
  quiz: { label: 'Quiz', verb: 'Check Yourself', icon: ListChecks, defaultMinutes: 10, fields: [] },
  assessment: { label: 'Assessment', verb: 'Prove It', icon: ShieldCheck, defaultMinutes: 20, fields: [] },
  assignment: { label: 'Assignment', verb: 'Apply', icon: ClipboardList, defaultMinutes: 30, fields: [
    { key: 'instructions', label: 'Instructions (Markdown)', kind: 'md' },
    { key: 'rubric', label: 'Rubric (Markdown)', kind: 'md' },
    { key: 'deadline', label: 'Deadline (optional, e.g. 2026-12-31)', kind: 'text' } ] },
  challenge: { label: 'Challenge', verb: 'Challenge', icon: Flag, defaultMinutes: 20, fields: [
    { key: 'description', label: 'Challenge description (Markdown)', kind: 'md' },
    { key: 'difficulty', label: 'Difficulty', kind: 'select', options: difficulty },
    { key: 'time_limit_minutes', label: 'Time limit (minutes)', kind: 'number' } ] },
  project: { label: 'Project', verb: 'Build', icon: Rocket, defaultMinutes: 60, fields: [
    { key: 'description', label: 'Project description (Markdown)', kind: 'md' },
    { key: 'requirements', label: 'Requirements (Markdown)', kind: 'md' },
    { key: 'deliverables', label: 'Deliverables (Markdown)', kind: 'md' },
    { key: 'evaluation_criteria', label: 'Evaluation criteria (Markdown)', kind: 'md' } ] }
}
export const typeDef = (t: string): TypeDef =>
  ACTIVITY_TYPES[t] ?? { label: t, verb: 'Do', icon: FileText, defaultMinutes: 10, fields: [] }
