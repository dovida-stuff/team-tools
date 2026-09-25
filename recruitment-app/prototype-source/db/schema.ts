import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const prototypeState = sqliteTable('prototype_state', {
  id: integer('id').primaryKey(),
  payload: text('payload').notNull(),
  updatedAt: text('updated_at').notNull(),
});
