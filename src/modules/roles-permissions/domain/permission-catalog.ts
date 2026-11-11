/**
 * Catálogo de permisos del sistema.
 *
 * Los permisos los define el código (cada uno corresponde a una verificación real
 * en un endpoint) y se sincronizan con la base de datos al arrancar. El administrador
 * no crea permisos: decide qué permisos tiene cada rol y, opcionalmente, cada usuario.
 *
 * Para agregar un permiso nuevo: añadirlo aquí y usarlo con @RequirePermissions().
 */
export const PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_CHANGE_STATUS: 'users:change-status',
  USERS_ASSIGN_ROLES: 'users:assign-roles',
  USERS_ASSIGN_PERMISSIONS: 'users:assign-permissions',
  USERS_RESET_PASSWORD: 'users:reset-password',
  USERS_DELETE: 'users:delete',

  ROLES_READ: 'roles:read',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',

  AREAS_READ: 'areas:read',
  AREAS_CREATE: 'areas:create',
  AREAS_UPDATE: 'areas:update',
  AREAS_DELETE: 'areas:delete',

  ANIMALS_READ: 'animals:read',
  ANIMALS_CREATE: 'animals:create',
  ANIMALS_UPDATE: 'animals:update',
  ANIMALS_CHANGE_STATUS: 'animals:change-status',
  ANIMALS_DELETE: 'animals:delete',
  ANIMAL_CATALOGS_MANAGE: 'animal-catalogs:manage',
  ANIMAL_PHOTOS_UPLOAD: 'animal-photos:upload',
  ANIMAL_PHOTOS_DELETE: 'animal-photos:delete',
  ANIMALS_ISSUE_CERTIFICATE: 'animals:issue-certificate',
  ANIMALS_CONFIRM_GENETIC_CATEGORY: 'animals:confirm-genetic-category',

  WEIGHINGS_WRITE: 'weighings:write',

  HEALTH_READ: 'health:read',
  HEALTH_WRITE: 'health:write',
  HEALTH_OVERRIDE_WITHDRAWAL: 'health:override-withdrawal',
  VETERINARY_PRODUCTS_MANAGE: 'veterinary-products:manage',

  REPRODUCTION_READ: 'reproduction:read',
  REPRODUCTION_WRITE: 'reproduction:write',
  REPRODUCTION_OVERRIDE_KINSHIP: 'reproduction:override-kinship',

  REVIEWS_READ: 'reviews:read',
  REVIEWS_CREATE: 'reviews:create',
  REVIEWS_RESOLVE: 'reviews:resolve',

  AUDIT_READ: 'audit:read',

  BACKUPS_CREATE: 'backups:create',
  BACKUPS_RESTORE: 'backups:restore',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface PermissionDefinition {
  code: PermissionCode;
  module: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    code: PERMISSIONS.USERS_READ,
    module: 'Usuarios',
    description: 'Ver usuarios y sus detalles',
  },
  {
    code: PERMISSIONS.USERS_CREATE,
    module: 'Usuarios',
    description: 'Crear usuarios',
  },
  {
    code: PERMISSIONS.USERS_UPDATE,
    module: 'Usuarios',
    description: 'Editar los datos de los usuarios',
  },
  {
    code: PERMISSIONS.USERS_CHANGE_STATUS,
    module: 'Usuarios',
    description: 'Activar o dar de baja usuarios',
  },
  {
    code: PERMISSIONS.USERS_ASSIGN_ROLES,
    module: 'Usuarios',
    description: 'Asignar roles a usuarios',
  },
  {
    code: PERMISSIONS.USERS_ASSIGN_PERMISSIONS,
    module: 'Usuarios',
    description: 'Otorgar o quitar permisos individuales a usuarios',
  },
  {
    code: PERMISSIONS.USERS_RESET_PASSWORD,
    module: 'Usuarios',
    description: 'Restablecer la contraseña de otros usuarios',
  },
  {
    code: PERMISSIONS.USERS_DELETE,
    module: 'Usuarios',
    description: 'Eliminar usuarios',
  },

  {
    code: PERMISSIONS.ROLES_READ,
    module: 'Roles y permisos',
    description: 'Ver roles y el catálogo de permisos',
  },
  {
    code: PERMISSIONS.ROLES_CREATE,
    module: 'Roles y permisos',
    description: 'Crear roles',
  },
  {
    code: PERMISSIONS.ROLES_UPDATE,
    module: 'Roles y permisos',
    description: 'Editar roles y sus permisos',
  },
  {
    code: PERMISSIONS.ROLES_DELETE,
    module: 'Roles y permisos',
    description: 'Eliminar roles',
  },

  { code: PERMISSIONS.AREAS_READ, module: 'Áreas', description: 'Ver áreas' },
  {
    code: PERMISSIONS.AREAS_CREATE,
    module: 'Áreas',
    description: 'Crear áreas',
  },
  {
    code: PERMISSIONS.AREAS_UPDATE,
    module: 'Áreas',
    description: 'Editar áreas',
  },
  {
    code: PERMISSIONS.AREAS_DELETE,
    module: 'Áreas',
    description: 'Eliminar áreas',
  },

  {
    code: PERMISSIONS.ANIMALS_READ,
    module: 'Animales',
    description:
      'Ver animales, su genealogía y los catálogos de razas y colores',
  },
  {
    code: PERMISSIONS.ANIMALS_CREATE,
    module: 'Animales',
    description: 'Registrar animales',
  },
  {
    code: PERMISSIONS.ANIMALS_UPDATE,
    module: 'Animales',
    description: 'Editar los datos de los animales y su certificado ABSID',
  },
  {
    code: PERMISSIONS.ANIMALS_CHANGE_STATUS,
    module: 'Animales',
    description:
      'Registrar la salida de animales (muerte, venta, faena, regalo)',
  },
  {
    code: PERMISSIONS.ANIMALS_DELETE,
    module: 'Animales',
    description: 'Eliminar animales registrados por error',
  },
  {
    code: PERMISSIONS.ANIMAL_CATALOGS_MANAGE,
    module: 'Animales',
    description: 'Administrar los catálogos de razas y colores',
  },
  {
    code: PERMISSIONS.ANIMAL_PHOTOS_UPLOAD,
    module: 'Animales',
    description:
      'Subir fotos de animales, corregir su descripción y fecha, y elegir la foto principal',
  },
  {
    code: PERMISSIONS.ANIMAL_PHOTOS_DELETE,
    module: 'Animales',
    description: 'Eliminar fotos del historial de los animales',
  },
  {
    code: PERMISSIONS.ANIMALS_ISSUE_CERTIFICATE,
    module: 'Animales',
    description:
      'Emitir el certificado (PDF) con toda la información del animal',
  },

  {
    code: PERMISSIONS.ANIMALS_CONFIRM_GENETIC_CATEGORY,
    module: 'Animales',
    description:
      'Confirmar la categoría genética de un animal según ABSID (la esperada al nacer u otra)',
  },

  {
    code: PERMISSIONS.WEIGHINGS_WRITE,
    module: 'Control de peso',
    description:
      'Registrar, corregir y eliminar pesajes (verlos solo requiere animals:read)',
  },

  {
    code: PERMISSIONS.HEALTH_READ,
    module: 'Sanidad',
    description:
      'Ver el registro sanitario, los eventos generales y el catálogo de productos veterinarios',
  },
  {
    code: PERMISSIONS.HEALTH_WRITE,
    module: 'Sanidad',
    description:
      'Registrar, corregir y eliminar eventos sanitarios y de manejo',
  },
  {
    code: PERMISSIONS.HEALTH_OVERRIDE_WITHDRAWAL,
    module: 'Sanidad',
    description:
      'Autorizar la faena de un animal en período de retiro (indicando el motivo)',
  },
  {
    code: PERMISSIONS.VETERINARY_PRODUCTS_MANAGE,
    module: 'Sanidad',
    description: 'Administrar el catálogo de productos veterinarios',
  },

  {
    code: PERMISSIONS.REPRODUCTION_READ,
    module: 'Reproducción',
    description:
      'Ver montas, diagnósticos de preñez, partos, indicadores reproductivos y sus recordatorios',
  },
  {
    code: PERMISSIONS.REPRODUCTION_WRITE,
    module: 'Reproducción',
    description:
      'Registrar y corregir montas, diagnósticos, abortos y partos (el parto crea las crías)',
  },
  {
    code: PERMISSIONS.REPRODUCTION_OVERRIDE_KINSHIP,
    module: 'Reproducción',
    description:
      'Autorizar una monta entre animales emparentados (indicando la justificación)',
  },

  {
    code: PERMISSIONS.REVIEWS_READ,
    module: 'Revisión de datos',
    description:
      'Ver los avisos de datos por revisar en animales, montas y partos',
  },
  {
    code: PERMISSIONS.REVIEWS_CREATE,
    module: 'Revisión de datos',
    description: 'Crear avisos de revisión sobre animales, montas y partos',
  },
  {
    code: PERMISSIONS.REVIEWS_RESOLVE,
    module: 'Revisión de datos',
    description:
      'Marcar un aviso de revisión como corregido (o reabrirlo), indicando qué se hizo',
  },

  {
    code: PERMISSIONS.AUDIT_READ,
    module: 'Auditoría',
    description: 'Ver el historial de inicios de sesión',
  },

  {
    code: PERMISSIONS.BACKUPS_CREATE,
    module: 'Sistema',
    description:
      'Descargar una copia de seguridad completa (base de datos, fotos y archivos)',
  },
  {
    code: PERMISSIONS.BACKUPS_RESTORE,
    module: 'Sistema',
    description:
      'Restaurar una copia de seguridad: reemplaza TODOS los datos y archivos actuales (antes se guarda un respaldo del estado actual)',
  },
];

/** Rol protegido que siempre tiene todos los permisos. */
export const SYSTEM_ADMIN_ROLE_NAME = 'Administrador';
