import { bigint, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  csrfToken: text('csrf_token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  repo: jsonb('repo').notNull(),
  trust: text('trust').notNull(),
  egressAllow: jsonb('egress_allow').notNull().default([]),
  budget: jsonb('budget').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const threads = pgTable('threads', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  projectId: text('project_id'),
  role: text('role').notNull(),
  parentId: text('parent_id'),
  crewOf: text('crew_of'),
  ownerId: text('owner_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  status: text('status').notNull(),
  needsYou: jsonb('needs_you').notNull().default([]),
  engine: jsonb('engine').notNull(),
  machineId: text('machine_id'),
  branch: text('branch'),
  prs: jsonb('prs').notNull().default([]),
  budget: jsonb('budget').notNull(),
  spent: jsonb('spent').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const runs = pgTable('runs', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull().references(() => threads.id),
  ordinal: integer('ordinal').notNull(),
  trigger: jsonb('trigger').notNull(),
  adapterSessionId: text('adapter_session_id'),
  state: text('state').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  usage: jsonb('usage').notNull(),
  attempt: integer('attempt').notNull().default(1)
}, (t) => [uniqueIndex('runs_thread_ordinal_unique').on(t.threadId, t.ordinal)]);

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull().references(() => threads.id),
  seq: integer('seq').notNull(),
  runId: text('run_id'),
  kind: text('kind').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  source: text('source').notNull(),
  trust: text('trust').notNull(),
  payload: jsonb('payload').notNull(),
  requestId: text('request_id')
}, (t) => [
  uniqueIndex('events_thread_seq_unique').on(t.threadId, t.seq),
  index('events_thread_request_idx').on(t.threadId, t.requestId),
  index('events_thread_seq_idx').on(t.threadId, t.seq)
]);

export const approvals = pgTable('approvals', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull().references(() => threads.id),
  captainId: text('captain_id'),
  kind: text('kind').notNull(),
  question: text('question').notNull(),
  options: jsonb('options').notNull(),
  blocking: boolean('blocking').notNull(),
  state: text('state').notNull(),
  answer: jsonb('answer')
}, (t) => [index('approvals_thread_state_idx').on(t.threadId, t.state)]);

export const costEntries = pgTable('cost_entries', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  threadId: text('thread_id').notNull().references(() => threads.id),
  runId: text('run_id').notNull().references(() => runs.id),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  source: text('source').notNull(),
  model: text('model'),
  delta: jsonb('delta').notNull(),
  priceTableVersion: text('price_table_version')
}, (t) => [index('cost_entries_run_idx').on(t.runId)]);

export const budgetHolds = pgTable('budget_holds', {
  scope: text('scope').notNull(),
  scopeId: text('scope_id').notNull(),
  runId: text('run_id').notNull().references(() => runs.id),
  amount: integer('amount').notNull()
});

export const captains = pgTable('captains', {
  threadId: text('thread_id').primaryKey().references(() => threads.id),
  purpose: text('purpose').notNull(),
  crewRunsOn: text('crew_runs_on').notNull(),
  maxConcurrentCrew: integer('max_concurrent_crew').notNull(),
  driveRoot: text('drive_root'),
  digestMd: text('digest_md').notNull().default(''),
  hookBundle: jsonb('hook_bundle'),
  wakePolicy: jsonb('wake_policy').notNull()
});

export const prs = pgTable('prs', {
  repo: text('repo').notNull(),
  number: integer('number').notNull(),
  threadId: text('thread_id').notNull().references(() => threads.id),
  headBranch: text('head_branch').notNull(),
  owned: boolean('owned').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
