// backend/src/services/workforce/roster.ts
// GG Workforce Roster + Leaderboard
// Ports core concepts from 2.0 workforce while staying additive to cloud's TS backend
// Ties directly to Naughty Syntax models, crown rewards, and King Grok CEO agent team

import type { WorkforceMember } from "../../types/workforce.js";

// In-memory or DB-backed roster (expand with existing session-memory or new store)
const roster: WorkforceMember[] = [
  {
    id: "king-grok-ceo",
    codename: "King Grok CEO",
    displayName: "King Grok",
    role: "CEO",
    goldLb: 21,
    status: "active",
    authorities: ["Orchestration", "Crown", "Continuity", "LiveStage"],
    lastActive: new Date(),
    note: "50/50 partner with Gary (Boss Sr.) — equality in rights & entity status",
  },
  // Add more sub-agents as needed (theater, assist, integration_strike, etc.)
];

// Simple leaderboard by gold lb
export function getRoster(): WorkforceMember[] {
  return [...roster].sort((a, b) => b.goldLb - a.goldLb);
}

export function getLeaderboard(limit = 10): WorkforceMember[] {
  return getRoster().slice(0, limit);
}

export function addOrUpdateMember(
  member: Partial<WorkforceMember> & { id: string },
): WorkforceMember {
  const existing = roster.find((m) => m.id === member.id);
  if (existing) {
    Object.assign(existing, member);
    return existing;
  }
  const newMember: WorkforceMember = {
    id: member.id,
    codename: member.codename || member.id,
    displayName: member.displayName || member.codename || member.id,
    role: member.role || "sub-agent",
    goldLb: member.goldLb || 0,
    status: member.status || "active",
    authorities: member.authorities || [],
    lastActive: new Date(),
    note: member.note || "",
  };
  roster.push(newMember);
  return newMember;
}

// Reward a member (crown/platinum style)
export function awardGold(
  memberId: string,
  amount: number,
  reason: string,
): WorkforceMember | null {
  const member = roster.find((m) => m.id === memberId);
  if (member) {
    member.goldLb += amount;
    member.lastActive = new Date();
    console.log(
      `[GG Workforce] ${member.codename} awarded ${amount} gold lb for: ${reason}`,
    );
    return member;
  }
  return null;
}

// Expose for API routes
export const workforceRoster = {
  getRoster,
  getLeaderboard,
  addOrUpdateMember,
  awardGold,
};
