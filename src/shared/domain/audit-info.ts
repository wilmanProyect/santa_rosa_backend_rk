export interface AuditInfo {
  createdAt: Date | null;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export const newAuditInfo = (actorId: string | null): AuditInfo => ({
  createdAt: null,
  createdBy: actorId,
  updatedAt: null,
  updatedBy: actorId,
});
