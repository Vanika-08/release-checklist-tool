export type ReleaseStatus = "planned" | "ongoing" | "done";

export interface StepDef {
  id: string;
  order: number;
  name: string;
}

export interface ReleaseStep extends StepDef {
  description: string;
  completed: boolean;
}

export interface ReleaseSummary {
  id: string;
  name: string;
  date: string;
  status: ReleaseStatus;
  completedSteps: string[];
  completedCount: number;
  totalSteps: number;
}

export interface ReleaseDetail extends ReleaseSummary {
  additionalInfo: string | null;
  createdAt: string;
  updatedAt: string;
  steps: ReleaseStep[];
}
