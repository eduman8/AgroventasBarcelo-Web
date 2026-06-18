export { machineCategories, machineStatuses } from '../utils/machines.js';

export const machinesMock = [
  {
    id: 'tractor-massey-ferguson-292',
    nombre: 'Tractor Massey Ferguson 292',
    marca: 'Massey Ferguson',
    categoria: 'Usada',
    estado: 'Disponible',
    descripcionCorta: 'Unidad seleccionada para tareas generales de campo, con potencia y confiabilidad.',
    descripcionLarga:
      'Tractor usado preparado para acompañar labores agropecuarias de uso diario. Se presenta como una opción confiable para productores que buscan potencia, versatilidad y soporte comercial cercano antes de avanzar con la consulta.',
    imagenPrincipal: null,
    galeria: [],
    disponible: true
  },
  {
    id: 'sembradora-cele-grano-fino',
    nombre: 'Sembradora CELE Grano Fino',
    marca: 'CELE',
    categoria: 'Nueva',
    estado: 'Disponible',
    descripcionCorta: 'Equipo preparado para siembra eficiente y uniforme en distintas condiciones de trabajo.',
    descripcionLarga:
      'Sembradora nueva orientada a lograr una implantación pareja y eficiente. La ficha queda preparada para sumar fotos, datos técnicos y condiciones comerciales cuando se habilite la carga definitiva de maquinarias.',
    imagenPrincipal: null,
    galeria: [],
    disponible: true
  },
  {
    id: 'rastra-discos-reforzada',
    nombre: 'Rastra de Discos Reforzada',
    marca: '',
    categoria: 'Usada',
    estado: 'Disponible',
    descripcionCorta: 'Implemento robusto para preparación de suelo y mantenimiento de lotes productivos.',
    descripcionLarga:
      'Rastra usada pensada para preparación y acondicionamiento de suelos. El detalle conserva datos mock para validar la navegación y deja la estructura lista para publicar especificaciones reales más adelante.',
    imagenPrincipal: null,
    galeria: [],
    disponible: true
  },
  {
    id: 'implemento-agricola-multiproposito',
    nombre: 'Implemento Agrícola Multipropósito',
    marca: '',
    categoria: 'Nueva',
    estado: 'Disponible',
    descripcionCorta: 'Solución práctica para complementar labores agropecuarias durante todo el año.',
    descripcionLarga:
      'Implemento nuevo de uso multipropósito para complementar tareas del campo. La publicación funciona como placeholder comercial hasta incorporar información técnica detallada e imágenes propias.',
    imagenPrincipal: null,
    galeria: [],
    disponible: true
  },
  {
    id: 'tractor-john-deere-730-vendido',
    nombre: 'Tractor John Deere 730',
    marca: 'John Deere',
    categoria: 'Usada',
    estado: 'Vendido',
    descripcionCorta: 'Unidad usada que se conserva publicada como antecedente comercial de AgroBarceló.',
    descripcionLarga:
      'Tractor usado ya vendido. La publicación permanece visible como parte del historial de maquinarias comercializadas y permite orientar consultas hacia opciones similares disponibles.',
    imagenPrincipal: null,
    galeria: [],
    disponible: false
  },
  {
    id: 'trabajo-reparacion-sembradora-cele',
    nombre: 'Reacondicionamiento de Sembradora CELE',
    marca: 'CELE',
    categoria: 'Trabajo Realizado',
    estado: 'Vendido',
    descripcionCorta: 'Trabajo realizado sobre equipo de siembra para recuperar funcionamiento y confiabilidad.',
    descripcionLarga:
      'Trabajo realizado de revisión y reacondicionamiento sobre una sembradora CELE. Esta ficha permite separar casos finalizados de la maquinaria disponible y preparar la sección para mostrar antecedentes con fotos en una etapa posterior.',
    imagenPrincipal: null,
    galeria: [],
    disponible: false
  },
  {
    id: 'trabajo-mantenimiento-tractor',
    nombre: 'Mantenimiento Integral de Tractor',
    marca: '',
    categoria: 'Trabajo Realizado',
    estado: 'Disponible',
    descripcionCorta: 'Intervención integral para sostener rendimiento y disponibilidad operativa del tractor.',
    descripcionLarga:
      'Trabajo realizado de mantenimiento integral sobre tractor agrícola. Se mantiene como contenido mock para validar cards, filtros y detalle sin conectar todavía con backend ni carga de imágenes.',
    imagenPrincipal: null,
    galeria: [],
    disponible: true
  }
];

export function getMachineById(id) {
  return machinesMock.find((machine) => machine.id === id);
}
