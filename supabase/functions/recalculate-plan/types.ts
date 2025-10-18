export interface PlanRecalculationRequest {
  planId?: string;
  trigger?: "manual" | "scheduled" | "post-training";
}

export interface PlanRecalculationResponse {
  status: "success" | "failure";
  plansUpdated: number;
  startedAt: string;
  completedAt: string;
  error?: string;
}
