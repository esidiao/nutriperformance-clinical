import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as https from 'https';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get()
  async check() {
    let dbOk = false;
    try {
      await this.dataSource.query('SELECT 1');
      dbOk = true;
    } catch {}

    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      database: dbOk ? 'connected' : 'disconnected',
    };
  }

  @Post('bootstrap')
  async bootstrap(@Body() body: { secret: string; authId: string; email: string; fullName: string }) {
    const expectedSecret = process.env.BOOTSTRAP_SECRET ?? 'nutri-bootstrap-2026';
    if (body?.secret !== expectedSecret) {
      return { error: 'Unauthorized' };
    }

    const { authId, email, fullName } = body;
    const wsSlug = 'admin-master';

    // Workspace
    let [ws] = await this.dataSource.query(`SELECT id FROM workspaces WHERE slug = $1`, [wsSlug]);
    if (!ws) {
      [ws] = await this.dataSource.query(
        `INSERT INTO workspaces (name, slug, plan, token_balance, is_active)
         VALUES ($1,$2,$3,$4,true) RETURNING id`,
        ['NutriPerformance Admin', wsSlug, 'institutional', 999999],
      );
    }
    const workspaceId = ws.id;

    // User
    const [existingUser] = await this.dataSource.query(`SELECT id FROM users WHERE auth_id = $1`, [authId]);
    let userId: string;
    if (existingUser) {
      await this.dataSource.query(
        `UPDATE users SET role='admin', is_active=true, workspace_id=$1, full_name=$2 WHERE auth_id=$3`,
        [workspaceId, fullName, authId],
      );
      userId = existingUser.id;
    } else {
      const [newUser] = await this.dataSource.query(
        `INSERT INTO users (workspace_id, auth_id, email, full_name, role, is_active)
         VALUES ($1,$2,$3,$4,'admin',true) RETURNING id`,
        [workspaceId, authId, email, fullName],
      );
      userId = newUser.id;
    }

    // Supabase metadata
    await this.updateSupabaseMeta(authId, workspaceId);

    return { success: true, workspaceId, userId };
  }

  private updateSupabaseMeta(authId: string, workspaceId: string): Promise<void> {
    const url = process.env.SUPABASE_URL ?? '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    const host = url.replace('https://', '');
    const body = JSON.stringify({
      user_metadata: { role: 'admin', workspace_id: workspaceId, full_name: 'Sidião' },
      app_metadata: { role: 'admin', is_admin: true, workspace_id: workspaceId },
    });
    return new Promise(resolve => {
      const req = https.request({
        hostname: host, path: `/auth/v1/admin/users/${authId}`, method: 'PUT',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, res => { res.on('data', () => {}); res.on('end', resolve); });
      req.on('error', () => resolve());
      req.write(body); req.end();
    });
  }
}
