import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { UserPresenter } from '@modules/users/infrastructure/presenters/user.presenter';
import { GetUserUseCase } from '@modules/users/application/use-cases/get-user.use-case';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../../domain/authenticated-user';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RefreshSessionUseCase } from '../../application/use-cases/refresh-session.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { ChangeOwnPasswordUseCase } from '../../application/use-cases/change-own-password.use-case';
import { ListLoginHistoryUseCase } from '../../application/use-cases/list-login-history.use-case';
import { LoginDto } from '../../application/dtos/login.dto';
import { RefreshTokenDto } from '../../application/dtos/refresh-token.dto';
import { ChangePasswordDto } from '../../application/dtos/change-password.dto';
import { LoginHistoryQueryDto } from '../../application/dtos/login-history-query.dto';
import { LoginAttempt } from '../../domain/models/login-attempt.model';
import { Public } from '../decorators/public.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AllowPendingPasswordChange } from '../decorators/allow-pending-password-change.decorator';
import {
  ClientContext,
  CurrentUser,
} from '../decorators/current-user.decorator';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly changeOwnPasswordUseCase: ChangeOwnPasswordUseCase,
    private readonly listLoginHistoryUseCase: ListLoginHistoryUseCase,
    private readonly getUserUseCase: GetUserUseCase,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con usuario y contraseña' })
  @ApiResponse({
    status: 200,
    description:
      'Tokens de acceso. Si mustChangePassword es true, el cliente debe pedir el cambio de contraseña.',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas, cuenta bloqueada o usuario inactivo.',
  })
  async login(@Body() dto: LoginDto, @ClientContext() context: RequestContext) {
    const { user, tokens } = await this.loginUseCase.execute(dto, context);
    return {
      ...tokens,
      mustChangePassword: user.getMustChangePassword(),
      user: {
        ...UserPresenter.toSummary(user),
        permissions: user.getEffectivePermissionCodes(),
      },
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar el access token (rota el refresh token)' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @ClientContext() context: RequestContext,
  ) {
    return this.refreshSessionUseCase.execute(dto, context);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @AllowPendingPasswordChange()
  @ApiOperation({ summary: 'Cerrar la sesión actual' })
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.logoutUseCase.execute(user.id, user.sessionId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @AllowPendingPasswordChange()
  @ApiOperation({
    summary: 'Cerrar todas las sesiones del usuario (todos los dispositivos)',
  })
  async logoutAll(@CurrentUser() user: AuthenticatedUser) {
    await this.logoutUseCase.execute(user.id, user.sessionId, true);
  }

  @Get('me')
  @ApiBearerAuth()
  @AllowPendingPasswordChange()
  @ApiOperation({
    summary: 'Perfil del usuario autenticado con sus permisos efectivos',
  })
  async me(@CurrentUser() current: AuthenticatedUser) {
    const user = await this.getUserUseCase.execute(current.id);
    return UserPresenter.toResponse(user);
  }

  @Put('me/password')
  @ApiBearerAuth()
  @AllowPendingPasswordChange()
  @ApiOperation({
    summary:
      'Cambiar la propia contraseña (cierra las demás sesiones y devuelve tokens nuevos)',
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @ClientContext() context: RequestContext,
  ) {
    return this.changeOwnPasswordUseCase.execute(user.id, dto, context);
  }

  @Get('login-history')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({
    summary: 'Historial de inicios de sesión (exitosos y fallidos)',
  })
  async loginHistory(@Query() query: LoginHistoryQueryDto) {
    const result = await this.listLoginHistoryUseCase.execute(
      { userId: query.userId, success: query.success },
      { page: query.page, limit: query.limit },
    );
    return {
      ...result,
      items: result.items.map((a) => presentLoginAttempt(a)),
    };
  }
}

function presentLoginAttempt(attempt: LoginAttempt) {
  return {
    id: attempt.getId(),
    userId: attempt.getUserId(),
    username: attempt.getUsername(),
    success: attempt.getSuccess(),
    failureReason: attempt.getFailureReason(),
    ip: attempt.getIp(),
    userAgent: attempt.getUserAgent(),
    createdAt: attempt.getCreatedAt(),
  };
}
