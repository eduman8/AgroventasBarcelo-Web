import nodemailer from "nodemailer";

const defaultContactEmail = 'eduman.000@gmail.com';

function getBooleanEnv(value) {
  return String(value).toLowerCase() === 'true';
}

function buildTransportConfig() {
  const config = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: getBooleanEnv(process.env.SMTP_SECURE)
  };

  if (process.env.SMTP_USER || process.env.SMTP_PASSWORD) {
    config.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    };
  }

  return config;
}

function getSelectedPartsLines(selectedParts) {
  if (!Array.isArray(selectedParts) || selectedParts.length === 0) {
    return [];
  }

  return [
    'Repuestos consultados:',
    '',
    ...selectedParts.flatMap((selectedPart) => [
      `* Código: ${selectedPart.code || 'Sin informar'}`,
      `  Nombre: ${selectedPart.name || 'Sin informar'}`,
      `  Origen: ${selectedPart.source === 'manual' ? 'Manual' : 'Catálogo'}`,
      ...(selectedPart.source === 'manual'
        ? [
            `  Manual: ${selectedPart.manual || 'Sin informar'}`,
            `  Página: ${selectedPart.page || 'Sin informar'}`,
            `  Categoría: ${selectedPart.category || 'Sin informar'}`
          ]
        : []),
      ''
    ])
  ];
}

function getManualInfoLines(manualInfo) {
  if (!manualInfo || !(manualInfo.manual || manualInfo.page || manualInfo.code)) {
    return [];
  }

  return [
    '',
    'Información de manual:',
    `Manual: ${manualInfo.manual || 'Sin informar'}`,
    `Página: ${manualInfo.page || 'Sin informar'}`,
    `Código: ${manualInfo.code || 'Sin informar'}`
  ];
}

function getContextLines(context) {
  if (!context) {
    return [];
  }

  return [
    '',
    'Contexto:',
    `- Tipo: ${context.type || 'Sin informar'}`,
    `- ID: ${context.id || 'Sin informar'}`,
    `- Nombre: ${context.name || 'Sin informar'}`,
    `- Código: ${context.code || 'Sin informar'}`,
    `- Marca: ${context.brand || 'Sin informar'}`
  ];
}

export function buildContactEmailText({ name, phone, email, subject, message, context, selectedParts, manualInfo }) {
  return [
    'Nueva consulta recibida desde AgroBarceló Web.',
    '',
    ...getSelectedPartsLines(selectedParts),
    `Nombre: ${name}`,
    `Teléfono: ${phone}`,
    `Email: ${email}`,
    `Motivo: ${subject}`,
    '',
    'Mensaje:',
    message,
    ...getManualInfoLines(manualInfo),
    ...getContextLines(context)
  ].join('\n');
}

export async function sendContactEmail(contactData) {
  const contactToEmail = process.env.CONTACT_TO_EMAIL || defaultContactEmail;
  const contactFromEmail = process.env.CONTACT_FROM_EMAIL || process.env.SMTP_USER || contactToEmail;
  const transporter = nodemailer.createTransport(buildTransportConfig());

  await transporter.sendMail({
    from: contactFromEmail,
    to: contactToEmail,
    replyTo: contactData.email,
    subject: `Nueva consulta desde AgroBarceló Web - ${contactData.subject}`,
    text: buildContactEmailText(contactData)
  });
}
