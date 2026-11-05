import { emptySessionPlan, type SessionPlan } from "../../src/lib/planning.ts";

export function completePlan(): SessionPlan {
  return {
    ...emptySessionPlan(),
    expectedPlayers: 12, confirmedCoaches: 2, availableBalls: 5, availableSmallGoals: 4, availableLargeGoals: 0,
    equipmentConfirmed: true, coachRoles: "To trenere, én per bane.", alternatives: "Samle gruppene og bruk færre baller.",
    exercises: [{
      id: "00000000-0000-4000-8000-000000000001", stage: "game", title: "Lokalt smålagsspill", durationMinutes: 60,
      objectives: "Finne medspiller", organization: "To baner, to grupper à seks.", description: "Spill tre mot tre med pauser og bytter.",
      coachingPoints: "Se opp før pasning.", easier: "Større bane.", harder: "Mindre bane.", localAdaptations: "Lokalt treningsopplegg.",
      sourceUrl: "", sourceAge: "", sourceCheckedOn: "", simultaneousGroups: 2, assignedPlayers: 12, coaches: 2,
      balls: 4, reserveBalls: 1, smallGoals: 4, largeGoals: 0,
    }],
  };
}
