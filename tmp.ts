import { sql } from 'drizzle-orm';
const { or } = require('drizzle-orm');
console.log(or(sql`1=1`, sql`1=2`));
