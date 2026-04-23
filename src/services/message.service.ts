import type { Notification, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/HttpError.js';
import type { SendMessageInput } from '../validators/message.schemas.js';

export const CHAT_TITLES = [
  'CHAT_CHW_HC',
  'CHAT_CHW_LC',
  'CHAT_HC_HOSPITAL',
  'CHAT_HOSPITAL_REFERRAL',
] as const;
type ChatTitle = (typeof CHAT_TITLES)[number];

type ApiRoleLabel =
  | 'CHW'
  | 'Health Center'
  | 'Health Post'
  | 'District Hospital'
  | 'Referral Hospital';

type ChatMeta = {
  channel: 'chw_hc' | 'chw_lc' | 'hc_hospital' | 'hospital_referral';
  conversationId: string;
  district: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
};

type ApiMessage = {
  id: string;
  text: string;
  sender: 'me' | 'them';
  senderName: string;
  senderRole: ApiRoleLabel;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  caseRef?: string;
};

type ApiConversation = {
  id: string;
  name: string;
  role: ApiRoleLabel;
  lastMessage: string;
  time: string;
  unreadCount: number;
  online: boolean;
  messages: ApiMessage[];
};

function districtSlug(district: string): string {
  return district.trim().toLowerCase().replace(/\s+/g, '-');
}

function parseMeta(raw: string | null): ChatMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ChatMeta>;
    if (
      !parsed.channel ||
      !parsed.conversationId ||
      !parsed.district ||
      !parsed.senderId ||
      !parsed.senderName ||
      !parsed.senderRole
    ) {
      return null;
    }
    if (
      parsed.channel !== 'chw_hc' &&
      parsed.channel !== 'chw_lc' &&
      parsed.channel !== 'hc_hospital' &&
      parsed.channel !== 'hospital_referral'
    ) {
      return null;
    }
    return parsed as ChatMeta;
  } catch {
    return null;
  }
}

function senderRoleLabel(role: UserRole): ApiRoleLabel {
  if (role === 'CHW') return 'CHW';
  if (role === 'HEALTH_CENTER') return 'Health Center';
  if (role === 'LOCAL_CLINIC') return 'Health Post';
  if (role === 'HOSPITAL') return 'District Hospital';
  return 'Referral Hospital';
}

function mapMessageRow(
  row: Notification,
  meta: ChatMeta,
  requesterId: string
): ApiMessage {
  return {
    id: row.id,
    text: row.message,
    sender: meta.senderId === requesterId ? 'me' : 'them',
    senderName: meta.senderName,
    senderRole: senderRoleLabel(meta.senderRole),
    timestamp: row.createdAt.toISOString(),
    status: row.read ? 'read' : 'delivered',
    caseRef: row.caseRef ?? undefined,
  };
}

function canSeeMessageForRole(
  role: UserRole,
  requesterId: string,
  row: Notification,
  meta: ChatMeta
): boolean {
  if (meta.senderRole === role && meta.senderId === requesterId) return true;
  if (role === 'CHW') return row.targetRole === 'CHW' && row.userId === requesterId;
  if (role === 'HEALTH_CENTER') return row.targetRole === 'HEALTH_CENTER';
  if (role === 'LOCAL_CLINIC') return row.targetRole === 'LOCAL_CLINIC';
  if (role === 'HOSPITAL') return row.targetRole === 'HOSPITAL';
  if (role === 'REFERRAL_HOSPITAL') return row.targetRole === 'REFERRAL_HOSPITAL';
  return false;
}

function allowedConversationIds(role: UserRole, district: string, requesterId: string) {
  const d = districtSlug(district);
  if (role === 'CHW')
    return new Set([`chw-hc:${requesterId}`, `chw-lc:${requesterId}`]);
  if (role === 'HEALTH_CENTER') return new Set([`hc-hospital:${d}`]);
  if (role === 'LOCAL_CLINIC') return new Set<string>();
  if (role === 'HOSPITAL') return new Set([`hc-hospital:${d}`, `hospital-referral:${d}`]);
  if (role === 'REFERRAL_HOSPITAL') return new Set([`hospital-referral:${d}`]);
  return new Set<string>();
}

function listCandidateRows() {
  return prisma.notification.findMany({
    where: { title: { in: [...CHAT_TITLES] } },
    orderBy: { createdAt: 'asc' },
    take: 2000,
  });
}

async function conversationDisplayName(
  conversationId: string,
  role: UserRole,
  district: string
) {
  if (conversationId.startsWith('chw-hc:')) {
    if (role === 'CHW') return `${district} Health Center`;
    const chwId = conversationId.replace('chw-hc:', '');
    const chw = await prisma.user.findUnique({
      where: { id: chwId },
      select: { name: true },
    });
    return chw?.name ?? 'Community Health Worker';
  }
  if (conversationId.startsWith('chw-lc:')) {
    if (role === 'CHW') return `${district} Health Post`;
    const chwId = conversationId.replace('chw-lc:', '');
    const chw = await prisma.user.findUnique({
      where: { id: chwId },
      select: { name: true },
    });
    return chw?.name ?? 'Community Health Worker';
  }
  if (conversationId.startsWith('hc-hospital:')) {
    if (role === 'HOSPITAL') return `${district} Health Center`;
    return `${district} District Hospital`;
  }
  if (conversationId.startsWith('hospital-referral:')) {
    if (role === 'REFERRAL_HOSPITAL') return `${district} District Hospital`;
    return 'Referral Hospital';
  }
  return 'Conversation';
}

function conversationRoleLabel(conversationId: string, role: UserRole): ApiRoleLabel {
  if (conversationId.startsWith('chw-hc:')) {
    return role === 'CHW' ? 'Health Center' : 'CHW';
  }
  if (conversationId.startsWith('chw-lc:')) {
    return role === 'CHW' ? 'Health Post' : 'CHW';
  }
  if (conversationId.startsWith('hc-hospital:')) {
    return role === 'HOSPITAL' ? 'Health Center' : 'District Hospital';
  }
  if (conversationId.startsWith('hospital-referral:')) {
    return role === 'REFERRAL_HOSPITAL' ? 'District Hospital' : 'Referral Hospital';
  }
  return 'District Hospital';
}

function titleForConversation(conversationId: string): ChatTitle {
  if (conversationId.startsWith('chw-hc:')) return 'CHAT_CHW_HC';
  if (conversationId.startsWith('chw-lc:')) return 'CHAT_CHW_LC';
  if (conversationId.startsWith('hc-hospital:')) return 'CHAT_HC_HOSPITAL';
  return 'CHAT_HOSPITAL_REFERRAL';
}

type Target = { role: UserRole; userId: string | null };

async function targetForSend(
  role: UserRole,
  conversationId: string,
  district: string
): Promise<Target> {
  const d = districtSlug(district);
  if (conversationId.startsWith('chw-hc:')) {
    const chwId = conversationId.replace('chw-hc:', '');
    if (role === 'CHW') return { role: 'HEALTH_CENTER', userId: null };
    if (role === 'HEALTH_CENTER') return { role: 'CHW', userId: chwId };
    throw new HttpError(403, 'This conversation is only for CHW and Health Center');
  }
  if (conversationId.startsWith('chw-lc:')) {
    const chwId = conversationId.replace('chw-lc:', '');
    if (role === 'CHW') return { role: 'LOCAL_CLINIC', userId: null };
    if (role === 'LOCAL_CLINIC') return { role: 'CHW', userId: chwId };
    throw new HttpError(403, 'This conversation is only for CHW and Health Post');
  }
  if (conversationId === `hc-hospital:${d}`) {
    if (role === 'HEALTH_CENTER') return { role: 'HOSPITAL', userId: null };
    if (role === 'HOSPITAL') return { role: 'HEALTH_CENTER', userId: null };
    throw new HttpError(403, 'This conversation is only for Health Center and District Hospital');
  }
  if (conversationId === `hospital-referral:${d}`) {
    if (role === 'HOSPITAL') return { role: 'REFERRAL_HOSPITAL', userId: null };
    if (role === 'REFERRAL_HOSPITAL') return { role: 'HOSPITAL', userId: null };
    throw new HttpError(403, 'This conversation is only for District and Referral Hospital');
  }
  throw new HttpError(403, 'Conversation not available for your district');
}

export async function listMessagingConversations(params: {
  requesterRole: UserRole;
  requesterId: string;
  requesterDistrict: string;
}) {
  if (
    params.requesterRole !== 'CHW' &&
    params.requesterRole !== 'HEALTH_CENTER' &&
    params.requesterRole !== 'LOCAL_CLINIC' &&
    params.requesterRole !== 'HOSPITAL' &&
    params.requesterRole !== 'REFERRAL_HOSPITAL'
  ) {
    throw new HttpError(403, 'This role cannot use messaging');
  }

  const allowed = allowedConversationIds(
    params.requesterRole,
    params.requesterDistrict,
    params.requesterId
  );
  const rows = await listCandidateRows();

  const scoped = rows
    .map((row) => ({ row, meta: parseMeta(row.recipientRoles) }))
    .filter((x): x is { row: Notification; meta: ChatMeta } => !!x.meta)
    .filter(({ row, meta }) => {
      if (
        meta.district.toLowerCase() !== params.requesterDistrict.toLowerCase()
      ) {
        return false;
      }
      if (
        !canSeeMessageForRole(
          params.requesterRole,
          params.requesterId,
          row,
          meta
        )
      ) {
        return false;
      }
      // HC must see CHW→HC threads (chw-hc:{chwId}); allowedConversationIds only listed hc-hospital before.
      if (
        params.requesterRole === 'HEALTH_CENTER' &&
        meta.conversationId.startsWith('chw-hc:')
      ) {
        return true;
      }
      if (
        params.requesterRole === 'LOCAL_CLINIC' &&
        meta.conversationId.startsWith('chw-lc:')
      ) {
        return true;
      }
      return allowed.has(meta.conversationId);
    });

  const byConversation = new Map<string, { rows: Notification[]; metas: ChatMeta[] }>();
  for (const { row, meta } of scoped) {
    const bucket = byConversation.get(meta.conversationId);
    if (!bucket) byConversation.set(meta.conversationId, { rows: [row], metas: [meta] });
    else {
      bucket.rows.push(row);
      bucket.metas.push(meta);
    }
  }

  if (params.requesterRole === 'CHW' && !byConversation.has(`chw-hc:${params.requesterId}`)) {
    byConversation.set(`chw-hc:${params.requesterId}`, { rows: [], metas: [] });
  }
  if (params.requesterRole === 'CHW' && !byConversation.has(`chw-lc:${params.requesterId}`)) {
    byConversation.set(`chw-lc:${params.requesterId}`, { rows: [], metas: [] });
  }

  const d = districtSlug(params.requesterDistrict);
  if (
    params.requesterRole === 'HEALTH_CENTER' &&
    !byConversation.has(`hc-hospital:${d}`)
  ) {
    byConversation.set(`hc-hospital:${d}`, { rows: [], metas: [] });
  }
  if (
    params.requesterRole === 'HOSPITAL' &&
    !byConversation.has(`hc-hospital:${d}`)
  ) {
    byConversation.set(`hc-hospital:${d}`, { rows: [], metas: [] });
  }
  if (
    params.requesterRole === 'HOSPITAL' &&
    !byConversation.has(`hospital-referral:${d}`)
  ) {
    byConversation.set(`hospital-referral:${d}`, { rows: [], metas: [] });
  }
  if (
    params.requesterRole === 'REFERRAL_HOSPITAL' &&
    !byConversation.has(`hospital-referral:${d}`)
  ) {
    byConversation.set(`hospital-referral:${d}`, { rows: [], metas: [] });
  }

  const conversations: ApiConversation[] = [];
  for (const [conversationId, bucket] of byConversation.entries()) {
    const allowEmpty =
      params.requesterRole === 'CHW' ||
      params.requesterRole === 'HEALTH_CENTER' ||
      params.requesterRole === 'LOCAL_CLINIC' ||
      params.requesterRole === 'HOSPITAL' ||
      params.requesterRole === 'REFERRAL_HOSPITAL';
    if (!allowEmpty && bucket.rows.length === 0) continue;
    const messages = bucket.rows.map((row, idx) =>
      mapMessageRow(row, bucket.metas[idx], params.requesterId)
    );
    const last = messages.at(-1);
    const unreadCount = messages.filter(
      (m) => m.sender === 'them' && m.status !== 'read'
    ).length;
    conversations.push({
      id: conversationId,
      name: await conversationDisplayName(
        conversationId,
        params.requesterRole,
        params.requesterDistrict
      ),
      role: conversationRoleLabel(conversationId, params.requesterRole),
      lastMessage: last?.text ?? '',
      time: last ? new Date(last.timestamp).toLocaleTimeString() : '',
      unreadCount,
      online: true,
      messages,
    });
  }

  conversations.sort((a, b) => {
    const ta = a.messages.at(-1)?.timestamp ?? '';
    const tb = b.messages.at(-1)?.timestamp ?? '';
    if (ta === tb) return a.name.localeCompare(b.name);
    return ta > tb ? -1 : 1;
  });

  return conversations;
}

/** Total unread incoming chat messages for navbar badges. */
export async function getMessagingUnreadCount(params: {
  requesterRole: UserRole;
  requesterId: string;
  requesterDistrict: string;
}): Promise<number> {
  const conversations = await listMessagingConversations(params);
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

/** Mark all incoming messages in a thread as read for the current user. */
export async function markMessagingConversationRead(params: {
  requesterRole: UserRole;
  requesterId: string;
  requesterDistrict: string;
  conversationId: string;
}): Promise<{ marked: number }> {
  const rows = await listCandidateRows();
  const ids: string[] = [];
  for (const row of rows) {
    const meta = parseMeta(row.recipientRoles);
    if (!meta || meta.conversationId !== params.conversationId) continue;
    if (meta.district.toLowerCase() !== params.requesterDistrict.toLowerCase()) {
      continue;
    }
    if (
      !canSeeMessageForRole(
        params.requesterRole,
        params.requesterId,
        row,
        meta
      )
    ) {
      continue;
    }
    const mapped = mapMessageRow(row, meta, params.requesterId);
    if (mapped.sender === 'them' && !row.read) ids.push(row.id);
  }
  if (ids.length === 0) return { marked: 0 };
  await prisma.notification.updateMany({
    where: { id: { in: ids } },
    data: { read: true },
  });
  return { marked: ids.length };
}

export async function sendMessagingMessage(params: {
  requesterRole: UserRole;
  requesterId: string;
  requesterName: string;
  requesterDistrict: string;
  input: SendMessageInput;
}) {
  const conversationId = params.input.conversationId.trim();
  const target = await targetForSend(
    params.requesterRole,
    conversationId,
    params.requesterDistrict
  );

  if (target.role === 'CHW' && target.userId) {
    const chw = await prisma.user.findUnique({
      where: { id: target.userId },
      select: { role: true, district: true },
    });
    if (!chw || chw.role !== 'CHW') throw new HttpError(404, 'CHW conversation user not found');
    if (chw.district.toLowerCase() !== params.requesterDistrict.toLowerCase()) {
      throw new HttpError(403, 'CHW conversation user must be in your district');
    }
  }

  const meta: ChatMeta = {
    channel:
      conversationId.startsWith('chw-hc:')
        ? 'chw_hc'
        : conversationId.startsWith('chw-lc:')
          ? 'chw_lc'
          : conversationId.startsWith('hc-hospital:')
            ? 'hc_hospital'
            : 'hospital_referral',
    conversationId,
    district: params.requesterDistrict,
    senderId: params.requesterId,
    senderName: params.requesterName,
    senderRole: params.requesterRole,
  };

  const created = await prisma.notification.create({
    data: {
      type: 'info',
      title: titleForConversation(conversationId),
      message: params.input.text.trim(),
      caseRef: params.input.caseRef?.trim() || undefined,
      targetRole: target.role,
      userId: target.userId,
      recipientRoles: JSON.stringify(meta),
      read: false,
    },
  });

  return {
    id: created.id,
    text: created.message,
    timestamp: created.createdAt.toISOString(),
  };
}
