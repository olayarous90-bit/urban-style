# URBAN STYLE — Plataforma de Comercio Electrónico de Moda Urbana

Plataforma de comercio electrónico moderna, de alto rendimiento y completa para la marca de moda streetwear **URBAN STYLE**. Diseñada para el mercado colombiano con cotización y generación de guías en tiempo real con **Mi Paquete v2**, carrito de compras persistente, checkout seguro con códigos DANE, confirmaciones automáticas por correo electrónico con plantillas HTML y panel de administración integral con autenticación criptográfica PBKDF2.

---

## 🚀 Arquitectura y Tecnologías

### Frontend
- **React 18** — Componentes modulares, hooks avanzados y estado reactivo.
- **Vite 5** — Bundler ultrarrápido con Hot Module Replacement (HMR).
- **CSS3 Moderno** — Variables CSS, diseño responsive (Mobile First), transiciones suaves y soporte de accesibilidad `prefers-reduced-motion`.

### Backend & Almacenamiento
- **Node.js & Express 5** — API REST modular, middlewares de seguridad, CORS y validación de esquemas.
- **SQLite3 (`better-sqlite3`)** — Base de datos relacional ultraligera con modo WAL (Write-Ahead Logging), llaves foráneas y compatibilidad serverless (`/tmp`).
- **Nodemailer** — Motor de envío de correos con plantillas HTML responsive y sistema de log de respaldo seguro.
- **Criptografía PBKDF2** — Hashing seguro de contraseñas de administradores con sal y 100.000 iteraciones.

### Logística e Integraciones
- **Mi Paquete v2 API** — Cotización dinámica de envíos por peso y dimensiones volumétricas, generación automática de guías de despacho y rastreo.
- **DANE Colombia** — Base de datos de los 33 departamentos de Colombia y sus municipios principales con códigos oficiales de 8 dígitos.

---

## ✨ Características Principales

1. **Catálogo y Experiencia de Usuario**:
   - 11 secciones interactivas: Barra de anuncios, Navegación responsive, Hero con llamado a la acción, Categorías destacadas, Catálogo de 8 productos con vista de detalle y selector de tallas, Colección Streetwear, Ofertas especiales con descuentos demostrativos, Franja de beneficios, Identidad de marca, Newsletter con validación y Footer con enlaces de interés y acceso administrativo.
   - Carrito de compras desplegable con persistencia automática en `localStorage`, cálculo de subtotales y contador dinámico.

2. **Checkout Especializado para Colombia**:
   - Selector inteligente de Departamento y Ciudad que autocompleta el código DANE oficial requerido por las transportadoras.
   - Cotización de flete en tiempo real según destino y peso de los artículos.
   - Métodos de pago flexibles: Contra Entrega (COD) y Pago Anticipado.
   - Protección contra envíos duplicados mediante clave de idempotencia (`idempotency_key`).

3. **Logística Automatizada (Mi Paquete v2)**:
   - Envío de paquetes con dimensiones y peso volumétrico calculados por producto.
   - Asignación de transportadoras aliadas (Coordinadora, Servientrega, Envia, TCC, Interrapidísimo).
   - Generación de número de guía, enlace de rastreo directo y respaldo ante contingencias.

4. **Notificaciones por Correo Electrónico**:
   - Envío automático de confirmación de pedido con resumen de productos, desglose de costos, dirección de entrega y botón de seguimiento de la guía de transporte.
   - Plantilla HTML compatible con clientes de correo móviles y de escritorio.
   - Historial de correos en base de datos (`email_logs`) y almacenamiento de copias locales.

5. **Panel de Control Administrativo (`/admin` o modal)**:
   - Acceso protegido por contraseña criptográfica (PBKDF2).
   - Métricas en tiempo real: Total recaudado, órdenes procesadas, guías generadas y productos activos.
   - Gestión de estados de pedidos (`PENDING` ➔ `PROCESSING` ➔ `SHIPPED` ➔ `DELIVERED` / `CANCELLED`).
   - Visor de logs de correo y acceso a las guías de transporte generadas.

---

## 🛠️ Instalación y Ejecución Local

### Prerrequisitos
- **Node.js** v18 o superior
- **npm** v9 o superior

### 1. Clonar el repositorio
```bash
git clone https://github.com/TU-USUARIO/urban-style.git
cd urban-style
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configuración del entorno
Crea tu archivo `.env` basado en la plantilla de ejemplo:
```bash
cp .env.example .env
```
Edita `.env` con tus credenciales y preferencias (ver sección de Variables de Entorno).

### 4. Iniciar los servidores de desarrollo

En una primera terminal, inicia la API Backend (puerto 4000):
```bash
npm run server
```

En una segunda terminal, inicia el Frontend Vite (puerto 3000):
```bash
npm run dev
```

Abre tu navegador en `http://localhost:3000` para ver la tienda o en `http://localhost:4000/api/health` para consultar el diagnóstico de la API.

---

## ⚙️ Variables de Entorno

El archivo `.env.example` contiene todas las variables requeridas y recomendadas:

| Variable | Descripción | Valor por Defecto / Ejemplo |
| :--- | :--- | :--- |
| `PORT` | Puerto de la API Express | `4000` |
| `ORIGIN_CITY` | Ciudad de despacho de la tienda | `BOGOTÁ D.C.` |
| `ORIGIN_DANE_CODE` | Código DANE de origen (8 dígitos) | `11001000` |
| `MIPAQUETE_APIKEY` | API Key provista por Mi Paquete | *(Cadena provista en el portal de Mi Paquete)* |
| `MIPAQUETE_SESSION_TRACKER` | UUID de seguimiento de sesión | *(UUID v4 aleatorio o asignado)* |
| `MIPAQUETE_BASE_URL` | Endpoint de la API Mi Paquete | `https://api-v2.dev.mpr.mipaquete.com` |
| `SMTP_HOST` | Host del servidor SMTP para correos | `smtp.gmail.com` |
| `SMTP_PORT` | Puerto del servidor SMTP | `587` |
| `SMTP_USER` | Usuario o correo de la cuenta remitente | `tu-tienda@urbanstyle.com` |
| `SMTP_PASS` | Contraseña o token de aplicación SMTP | `tu_contraseña_aplicacion` |
| `ADMIN_DEFAULT_USER` | Usuario del administrador | `admin` |
| `ADMIN_DEFAULT_PASS` | Contraseña inicial del administrador | `UrbanStyle2026!` |

---

## 🔐 Credenciales del Panel Administrativo

Por defecto, la base de datos se inicializa automáticamente con un usuario administrador:
- **Usuario**: `admin`
- **Contraseña**: `UrbanStyle2026!`

*Nota: Se recomienda cambiar esta contraseña en entornos de producción modificando la variable `ADMIN_DEFAULT_PASS` o desde el panel.*

---

## 📦 Estructura del Proyecto

```
urban-style/
├── api/
│   └── index.js              # Entrypoint serverless para despliegues en Vercel
├── public/
│   ├── favicon.svg           # Isotipo vectorial de la marca
│   └── hero-urban.jpg        # Fotografía editorial de portada
├── server/
│   ├── data/                 # Base de datos SQLite local (excluida de git)
│   ├── db/
│   │   ├── database.js       # Inicialización de tablas y conexión better-sqlite3
│   │   └── colombia-locations.json # Departamentos y códigos DANE oficiales
│   ├── routes/
│   │   ├── admin.js          # Rutas protegidas del panel administrativo y métricas
│   │   ├── locations.js      # Endpoint de búsqueda y listado DANE
│   │   ├── orders.js         # Creación de pedidos, checkout e idempotencia
│   │   └── shipping.js       # Cotización y despacho con Mi Paquete v2
│   ├── services/
│   │   ├── mailer.js         # Motor Nodemailer y plantillas HTML
│   │   └── mipaquete.js      # Cliente HTTP para API Mi Paquete v2
│   └── index.js              # Servidor Express principal
├── src/
│   ├── components/           # Componentes UI (Navbar, Footer, Modal, Carrito, etc.)
│   ├── sections/             # Secciones de la landing page (Hero, Products, AdminModal, etc.)
│   ├── styles/               # Hojas de estilo CSS modulares y globales
│   ├── App.jsx               # Componente raíz con estado del carrito y checkout
│   └── main.jsx              # Montaje de React DOM
├── .env.example              # Plantilla documentada de variables de entorno
├── .gitignore                # Reglas de exclusión para git (sin secretos ni DBs)
├── package.json              # Dependencias y scripts de construcción
├── vercel.json               # Configuración de rutas y rewrites para Vercel
├── vite.config.js            # Configuración de compilación Vite
└── README.md                 # Documentación técnica completa
```

---

## ☁️ Despliegue en Vercel

Este proyecto está configurado para ejecutarse en **Vercel** combinando el frontend estático de Vite con Serverless Functions de Node.js:

1. Conecta el repositorio de GitHub en el panel de **Vercel**.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. En la sección **Environment Variables** de Vercel, agrega las variables de tu archivo `.env` (`MIPAQUETE_APIKEY`, `SMTP_HOST`, `ADMIN_DEFAULT_PASS`, etc.).
6. Vercel desplegará automáticamente la interfaz web y enrutará las peticiones `/api/*` hacia `api/index.js`.

---

## 📄 Licencia

Este proyecto fue desarrollado para la marca **URBAN STYLE**. Todos los derechos reservados.
