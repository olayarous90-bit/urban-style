/**
 * Base de Datos Oficial de Departamentos y Municipios de Colombia con Códigos DANE
 * Estructurada para cotización y despacho con Mi Paquete y transportadoras nacionales.
 */

export const COLOMBIAN_LOCATIONS = [
  {
    department: 'BOGOTÁ D.C.',
    cities: [
      { name: 'BOGOTÁ D.C.', daneCode: '11001000' }
    ]
  },
  {
    department: 'ANTIOQUIA',
    cities: [
      { name: 'MEDELLÍN', daneCode: '05001000' },
      { name: 'BELLO', daneCode: '05088000' },
      { name: 'ENVIGADO', daneCode: '05266000' },
      { name: 'ITAGÜÍ', daneCode: '05360000' },
      { name: 'SABANETA', daneCode: '05631000' },
      { name: 'RIONEGRO', daneCode: '05615000' },
      { name: 'APARTADÓ', daneCode: '05045000' },
      { name: 'CALDAS', daneCode: '05129000' },
      { name: 'COPACABANA', daneCode: '05212000' },
      { name: 'LA ESTRELLA', daneCode: '05380000' },
      { name: 'MARINILLA', daneCode: '05440000' },
      { name: 'CAUCASIA', daneCode: '05154000' },
      { name: 'TURBO', daneCode: '05837000' },
      { name: 'GIRARDOTA', daneCode: '05308000' }
    ]
  },
  {
    department: 'VALLE DEL CAUCA',
    cities: [
      { name: 'CALI', daneCode: '76001000' },
      { name: 'PALMIRA', daneCode: '76520000' },
      { name: 'BUENAVENTURA', daneCode: '76109000' },
      { name: 'TULUÁ', daneCode: '76834000' },
      { name: 'CARTAGO', daneCode: '76147000' },
      { name: 'BUGA (GUADALAJARA DE BUGA)', daneCode: '76111000' },
      { name: 'YUMBO', daneCode: '76892000' },
      { name: 'JAMUNDÍ', daneCode: '76364000' },
      { name: 'CANDELARIA', daneCode: '76130000' },
      { name: 'ZARZAL', daneCode: '76895000' }
    ]
  },
  {
    department: 'ATLÁNTICO',
    cities: [
      { name: 'BARRANQUILLA', daneCode: '08001000' },
      { name: 'SOLEDAD', daneCode: '08758000' },
      { name: 'MALAMBO', daneCode: '08433000' },
      { name: 'SABANALARGA', daneCode: '08638000' },
      { name: 'PUERTO COLOMBIA', daneCode: '08573000' },
      { name: 'BARANOA', daneCode: '08078000' },
      { name: 'GALAPA', daneCode: '08296000' }
    ]
  },
  {
    department: 'SANTANDER',
    cities: [
      { name: 'BUCARAMANGA', daneCode: '68001000' },
      { name: 'FLORIDABLANCA', daneCode: '68276000' },
      { name: 'GIRÓN', daneCode: '68307000' },
      { name: 'PIEDECUESTA', daneCode: '68547000' },
      { name: 'BARRANCABERMEJA', daneCode: '68081000' },
      { name: 'SAN GIL', daneCode: '68679000' },
      { name: 'SOCORRO', daneCode: '68755000' },
      { name: 'LEBRIJA', daneCode: '68406000' }
    ]
  },
  {
    department: 'CUNDINAMARCA',
    cities: [
      { name: 'SOACHA', daneCode: '25754000' },
      { name: 'CHÍA', daneCode: '25175000' },
      { name: 'ZIPAQUIRÁ', daneCode: '25899000' },
      { name: 'FACATATIVÁ', daneCode: '25269000' },
      { name: 'FUSAGASUGÁ', daneCode: '25290000' },
      { name: 'MADRID', daneCode: '25430000' },
      { name: 'MOSQUERA', daneCode: '25473000' },
      { name: 'FUNZA', daneCode: '25286000' },
      { name: 'CAJICÁ', daneCode: '25126000' },
      { name: 'GIRARDOT', daneCode: '25307000' },
      { name: 'COTA', daneCode: '25214000' },
      { name: 'SOPÓ', daneCode: '25758000' },
      { name: 'TOCANCIPÁ', daneCode: '25817000' }
    ]
  },
  {
    department: 'BOLÍVAR',
    cities: [
      { name: 'CARTAGENA', daneCode: '13001000' },
      { name: 'MAGANGUÉ', daneCode: '13430000' },
      { name: 'TURBACO', daneCode: '13836000' },
      { name: 'ARJONA', daneCode: '13052000' },
      { name: 'EL CARMEN DE BOLÍVAR', daneCode: '13244000' }
    ]
  },
  {
    department: 'RISARALDA',
    cities: [
      { name: 'PEREIRA', daneCode: '66001000' },
      { name: 'DOSQUEBRADAS', daneCode: '66170000' },
      { name: 'SANTA ROSA DE CABAL', daneCode: '66682000' },
      { name: 'LA VIRGINIA', daneCode: '66400000' }
    ]
  },
  {
    department: 'CALDAS',
    cities: [
      { name: 'MANIZALES', daneCode: '17001000' },
      { name: 'VILLAMARÍA', daneCode: '17873000' },
      { name: 'CHINCHINÁ', daneCode: '17174000' },
      { name: 'LA DORADA', daneCode: '17380000' },
      { name: 'ANSERMA', daneCode: '17042000' }
    ]
  },
  {
    department: 'QUINDÍO',
    cities: [
      { name: 'ARMENIA', daneCode: '63001000' },
      { name: 'CALARCÁ', daneCode: '63130000' },
      { name: 'LA TEBAIDA', daneCode: '63401000' },
      { name: 'MONTENEGRO', daneCode: '63470000' },
      { name: 'QUIMBAYA', daneCode: '63594000' }
    ]
  },
  {
    department: 'NORTE DE SANTANDER',
    cities: [
      { name: 'CÚCUTA', daneCode: '54001000' },
      { name: 'VILLA DEL ROSARIO', daneCode: '54874000' },
      { name: 'LOS PATIOS', daneCode: '54405000' },
      { name: 'OCAÑA', daneCode: '54498000' },
      { name: 'PAMPLONA', daneCode: '54518000' }
    ]
  },
  {
    department: 'TOLIMA',
    cities: [
      { name: 'IBAGUÉ', daneCode: '73001000' },
      { name: 'ESPINAL', daneCode: '73268000' },
      { name: 'MELGAR', daneCode: '73449000' },
      { name: 'CHAPARRAL', daneCode: '73168000' },
      { name: 'LÍBANO', daneCode: '73411000' }
    ]
  },
  {
    department: 'HUILA',
    cities: [
      { name: 'NEIVA', daneCode: '41001000' },
      { name: 'PITALITO', daneCode: '41551000' },
      { name: 'GARZÓN', daneCode: '41298000' },
      { name: 'LA PLATA', daneCode: '41396000' }
    ]
  },
  {
    department: 'META',
    cities: [
      { name: 'VILLAVICENCIO', daneCode: '50001000' },
      { name: 'ACACÍAS', daneCode: '50006000' },
      { name: 'GRANADA', daneCode: '50313000' },
      { name: 'PUERTO LÓPEZ', daneCode: '50573000' }
    ]
  },
  {
    department: 'NARIÑO',
    cities: [
      { name: 'PASTO', daneCode: '52001000' },
      { name: 'IPIALES', daneCode: '52356000' },
      { name: 'TUMACO', daneCode: '52835000' }
    ]
  },
  {
    department: 'MAGDALENA',
    cities: [
      { name: 'SANTA MARTA', daneCode: '47001000' },
      { name: 'CIÉNAGA', daneCode: '47189000' },
      { name: 'FUNDACIÓN', daneCode: '47288000' },
      { name: 'EL BANCO', daneCode: '47245000' }
    ]
  },
  {
    department: 'CÓRDOBA',
    cities: [
      { name: 'MONTERÍA', daneCode: '23001000' },
      { name: 'CERETÉ', daneCode: '23162000' },
      { name: 'SAHAGÚN', daneCode: '23660000' },
      { name: 'LORICA', daneCode: '23417000' }
    ]
  },
  {
    department: 'CESAR',
    cities: [
      { name: 'VALLEDUPAR', daneCode: '20001000' },
      { name: 'AGUACHICA', daneCode: '20011000' },
      { name: 'AGUSTÍN CODAZZI', daneCode: '20013000' }
    ]
  },
  {
    department: 'CAUCA',
    cities: [
      { name: 'POPAYÁN', daneCode: '19001000' },
      { name: 'SANTANDER DE QUILICHAO', daneCode: '19698000' },
      { name: 'PUERTO TEJADA', daneCode: '19573000' }
    ]
  },
  {
    department: 'BOYACÁ',
    cities: [
      { name: 'TUNJA', daneCode: '15001000' },
      { name: 'DUITAMA', daneCode: '15238000' },
      { name: 'SOGAMOSO', daneCode: '15759000' },
      { name: 'CHIQUINQUIRÁ', daneCode: '15176000' },
      { name: 'PUERTO BOYACÁ', daneCode: '15572000' }
    ]
  },
  {
    department: 'SUCRE',
    cities: [
      { name: 'SINCELEJO', daneCode: '70001000' },
      { name: 'COROZAL', daneCode: '70215000' },
      { name: 'SAN MARCOS', daneCode: '70708000' }
    ]
  },
  {
    department: 'LA GUAJIRA',
    cities: [
      { name: 'RIOHACHA', daneCode: '44001000' },
      { name: 'MAICAO', daneCode: '44430000' },
      { name: 'FONSECA', daneCode: '44279000' }
    ]
  },
  {
    department: 'CASANARE',
    cities: [
      { name: 'YOPAL', daneCode: '85001000' },
      { name: 'AGUAZUL', daneCode: '85010000' },
      { name: 'VILLANUEVA', daneCode: '85440000' }
    ]
  },
  {
    department: 'CAQUETÁ',
    cities: [
      { name: 'FLORENCIA', daneCode: '18001000' },
      { name: 'SAN VICENTE DEL CAGUÁN', daneCode: '18753000' }
    ]
  },
  {
    department: 'CHOCÓ',
    cities: [
      { name: 'QUIBDÓ', daneCode: '27001000' },
      { name: 'ISTMINA', daneCode: '27361000' }
    ]
  },
  {
    department: 'PUTUMAYO',
    cities: [
      { name: 'MOCOA', daneCode: '86001000' },
      { name: 'PUERTO ASÍS', daneCode: '86568000' }
    ]
  },
  {
    department: 'ARAUCA',
    cities: [
      { name: 'ARAUCA', daneCode: '81001000' },
      { name: 'SARAVENA', daneCode: '81736000' },
      { name: 'TAME', daneCode: '81794000' }
    ]
  },
  {
    department: 'SAN ANDRÉS Y PROVIDENCIA',
    cities: [
      { name: 'SAN ANDRÉS', daneCode: '88001000' },
      { name: 'PROVIDENCIA', daneCode: '88564000' }
    ]
  },
  {
    department: 'AMAZONAS',
    cities: [
      { name: 'LETICIA', daneCode: '91001000' }
    ]
  },
  {
    department: 'GUAVIARE',
    cities: [
      { name: 'SAN JOSÉ DEL GUAVIARE', daneCode: '95001000' }
    ]
  },
  {
    department: 'VICHADA',
    cities: [
      { name: 'PUERTO CARREÑO', daneCode: '99001000' }
    ]
  },
  {
    department: 'GUAINÍA',
    cities: [
      { name: 'INÍRIDA', daneCode: '94001000' }
    ]
  },
  {
    department: 'VAUPÉS',
    cities: [
      { name: 'MITÚ', daneCode: '97001000' }
    ]
  }
];

export function findLocationByDane(daneCode) {
  for (const dep of COLOMBIAN_LOCATIONS) {
    const city = dep.cities.find((c) => c.daneCode === daneCode);
    if (city) {
      return { department: dep.department, city: city.name, daneCode };
    }
  }
  return null;
}
