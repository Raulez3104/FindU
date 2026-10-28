# FindU

Plataforma universitaria para gestionar objetos perdidos y encontrados. Este repositorio reúne la aplicación móvil, el panel administrativo y la API.

## Estructura

```text
FindU/          Aplicación móvil React Native + Expo
findu-admin/    Panel administrativo React + Vite
findu-backend/  API Express + PostgreSQL
```

Cada componente conserva dependencias y comandos independientes. La raíz no utiliza npm workspaces ni contiene un `package.json` común.

## Requisitos

- Node.js y npm compatibles con los paquetes declarados.
- PostgreSQL accesible con el esquema requerido por FindU.
- Credenciales OAuth de Google para probar el inicio de sesión.

Las credenciales y variables locales nunca deben publicarse.

## Instalación

Ejecuta por separado:

```powershell
cd FindU
npm ci

cd ..\findu-admin
npm ci

cd ..\findu-backend
npm ci
```

## Configuración local

### Aplicación móvil

Copia `FindU/.env.example` como `FindU/.env` y completa las variables necesarias. En un dispositivo físico, `EXPO_PUBLIC_API_URL` debe apuntar a una dirección del backend accesible desde el dispositivo; `localhost` corresponde al propio teléfono.

### Panel administrativo

En desarrollo, Vite utiliza su proxy local hacia el backend. Opcionalmente se puede definir `VITE_API_URL` en un `.env` local no versionado.

### Backend

Copia `findu-backend/.env.example` como `findu-backend/.env` y completa PostgreSQL, OAuth y JWT. El repositorio no incluye credenciales ni aplica scripts SQL automáticamente.

## Ejecución

Desde cada directorio:

```powershell
# Móvil
npm start

# Panel administrativo
npm run dev

# Backend
npm run dev
```

El backend utiliza el puerto `3000` por defecto.

## Verificación

```powershell
# Móvil, desde FindU/
npm run lint
npm run typecheck

# Panel, desde findu-admin/
npm run build
npm run lint

# Backend, desde findu-backend/
npm test
```

Las verificaciones de interfaz requieren además probar manualmente los flujos afectados. Los builds, lint y typecheck no sustituyen esa comprobación funcional.

## Archivos que no se publican

- `.env` y credenciales.
- `node_modules/`, cachés y builds generados.
- Imágenes cargadas durante la ejecución en `findu-backend/uploads/`.
- Llaves, certificados y archivos de firma.

El backend crea `uploads/` cuando inicia si la carpeta todavía no existe.
