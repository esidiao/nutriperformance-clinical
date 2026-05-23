import { Controller, Post, Body, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

@Controller('bootstrap')
export class BootstrapController {
  private readonly logger = new Logger(BootstrapController.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Post()
  async bootstrap(@Body() body: { secret: string; authId: string; email: string; fullName: string }) {
    const expectedSecret = this.config.get<string>('BOOTSTRAP_SECRET') ?? 'nutri-bootstrap-2026';
    if (body.secret !== expectedSecret) {
      throw new UnauthorizedException('Secret inválido');
    }

    const { authId, email, fullName } = body;

    // 1. Criar ou recuperar workspace admin
    const wsSlug = 'admin-master';
    let workspace: any;
    const [existingWs] = await this.db.query(
      `SELECT id FROM workspaces WHERE slug = $1`, [wsSlug],
    );

    if (existingWs) {
      workspace = existingWs;
      this.logger.log(`Workspace existente: ${workspace.id}`);
    } else {
      const [newWs] = await this.db.query(
        `INSERT INTO workspaces (name, slug, plan, token_balance, is_active)
         VALUES ($1, $2, $3, $4, true) RETURNING id`,
        ['NutriPerformance Admin', wsSlug, 'institutional', 999999],
      );
      workspace = newWs;
      this.logger.log(`Workspace criado: ${workspace.id}`);
    }

    const workspaceId = workspace.id;

    // 2. Criar ou atualizar usuário admin
    const [existingUser] = await this.db.query(
      `SELECT id FROM users WHERE auth_id = $1`, [authId],
    );

    let userId: string;
    if (existingUser) {
      await this.db.query(
        `UPDATE users SET role = 'admin', is_active = true, workspace_id = $1, full_name = $2 WHERE auth_id = $3`,
        [workspaceId, fullName, authId],
      );
      userId = existingUser.id;
      this.logger.log(`Usuário atualizado: ${userId}`);
    } else {
      const [newUser] = await this.db.query(
        `INSERT INTO users (workspace_id, auth_id, email, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, 'admin', true) RETURNING id`,
        [workspaceId, authId, email, fullName],
      );
      userId = newUser.id;
      this.logger.log(`Usuário criado: ${userId}`);
    }

    // 3. Atualizar Supabase metadata com workspace_id
    await this.updateSupabaseMetadata(authId, workspaceId);

    return {
      success: true,
      workspaceId,
      userId,
      message: 'Admin bootstrap concluído com sucesso',
    };
  }

  private updateSupabaseMetadata(authId: string, workspaceId: string): Promise<void> {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL') ?? '';
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const host = supabaseUrl.replace('https://', '');

    return new Promise((resolve) => {
      const body = JSON.stringify({
        user_metadata: { role: 'admin', workspace_id: workspaceId, full_name: 'Sidião' },
        app_metadata: { role: 'admin', is_admin: true, workspace_id: workspaceId },
      });

      const req = https.request({
        hostname: host,
        path: `/auth/v1/admin/users/${authId}`,
        method: 'PUT',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      }, (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve());
      });
      req.on('error', () => resolve());
      req.write(body);
      req.end();
    });
  }
}
