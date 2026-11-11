import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@modules/auth/domain/authenticated-user';
import { GeneticCategoryService } from '../../application/use-cases/animals/genetic-category.service';
import { ConfirmGeneticCategoryDto } from '../../application/dtos/confirm-genetic-category.dto';
import { GeneticCategoryChange } from '../../domain/models/genetic-category-change';

@ApiTags('Animales')
@ApiBearerAuth()
@Controller('animals/:animalId/genetic-category')
export class GeneticCategoryController {
  constructor(private readonly categories: GeneticCategoryService) {}

  @Post('confirm')
  @RequirePermissions(PERMISSIONS.ANIMALS_CONFIRM_GENETIC_CATEGORY)
  @ApiOperation({
    summary:
      'Confirmar la categoría genética según ABSID (la esperada, u otra si ABSID asignó una distinta)',
  })
  async confirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('animalId', ParseUUIDPipe) animalId: string,
    @Body() dto: ConfirmGeneticCategoryDto,
  ) {
    const { animal, change } = await this.categories.confirm(
      actor.id,
      animalId,
      dto,
    );
    return {
      animalId,
      geneticCategory: animal.getGeneticCategory(),
      geneticCategoryConfirmed: animal.getGeneticCategoryConfirmed(),
      absidCertificateCode: animal.getAbsidCertificateCode(),
      change: present(change),
    };
  }

  @Get('history')
  @RequirePermissions(PERMISSIONS.ANIMALS_READ)
  @ApiOperation({
    summary:
      'Historial de categoría genética del animal (del más antiguo al más reciente)',
  })
  async history(@Param('animalId', ParseUUIDPipe) animalId: string) {
    const changes = await this.categories.history(animalId);
    return changes.map(present);
  }
}

const present = (c: GeneticCategoryChange) => ({
  id: c.id,
  fromCategory: c.fromCategory,
  toCategory: c.toCategory,
  kind: c.kind,
  changedOn: c.changedOn,
  absidCertificateCode: c.absidCertificateCode,
  notes: c.notes,
  createdAt: c.createdAt,
  createdBy: c.createdBy,
});
