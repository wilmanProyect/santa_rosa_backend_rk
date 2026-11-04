# Revisión de las planillas antes de cargar a producción

Archivos revisados (2026-11-04): `Animales.csv` (387 animales), `Pesaje.csv` (1.308 pesajes) y `Registro_Sanitario.csv` (506 eventos).

Los números de **línea** son los del archivo CSV (la línea 1 es el encabezado). En Excel equivalen a la fila del mismo número.

Cada observación está en uno de dos grupos:

- **Se corrige sola al importar:** la regla es clara y no hace falta tocar el Excel.
- **Revisar en el Excel:** hace falta alguien que conozca los animales. Si no se corrige, se importa como se indica en cada punto.

---

## 1. Se corrige sola al importar

> **Ya resuelto en los archivos (2026-11-04):**
>
> - Los CSV se exportaron de nuevo en UTF-8, así que las tildes y la ñ se ven bien: BONIÑA, SUEÑO, DÓLAR, DESPARASITACIÓN, neumonía, PREÑADA.
> - La fecha de L198 (217 MORENA) ya figura como 18/11/2025.
>
> Aparte de eso, los datos no cambiaron.

| Problema | Ejemplo | Corrección |
| --- | --- | --- |
| Colores escritos de otra forma | L159 `CAFÉ CHOCOLATE`, L161 `OVERA CAFÉ` | CAFÉ CHOCOLATE → Café. OVERA CAFÉ no está en la lista de colores acordada: ver 2.1. |
| Padre escrito como número decimal | L333 (CRS-54 DIAMANTINA): padre `135.00` | 135 |
| Sexo escrito de varias formas | `HEMBRA`, `Hembra`, `Hembra cria`, `Macho cria`, `MACHO - REPROD` | Hembra / Macho. "REPROD" queda anotado como reproductor. |
| Guiones como "sin dato" | Boer: madre ` -   `, peso ` -   ` | vacío |
| Categoría `POR DEFINIR` (254 animales) | — | Sin categoría; se completa después en el sistema. |
| Aretes sin el cero a la izquierda en **sanitario** (Excel los borró) | `5`, `7`, `9`, `4`, `233`, `239`, `287`, `330`, `354`, `425`, `506`, `539`, `974` (39 filas) | 05, 07, 09, 04, 00233, 00239, 0287, 0330, 0354, 0425, 0506, 0539, 0974. Cada uno corresponde a un solo animal vivo. |
| Pesajes con observación de sanidad ("CASQUEO", "HERIDA EN EL LABIO", "APCESO DRENAR"...) | L1136–L1216 | Quedan como nota del pesaje. Ya están cargados en `Registro_Sanitario.csv` ("Anotado en pesaje de octubre"), así que no se duplican. |
| La columna `ARETE o ABSID` de pesajes y sanitario | — | Se toma como **arete**. Los 236 pesajes de nacimiento coinciden con la fecha de nacimiento por arete, y solo 1 coincide por ABSID. |

---

## 2. Revisar en el Excel — Animales

### 2.1 Valores que el sistema no tiene

- **L233, arete 55 JADE: `PERDIDO` (23/10/2026).** Decidido: el sistema va a tener el estado **Perdido**. No hace falta cambiar nada en el Excel.
- **L161, 303 ANDROMEDA: color `OVERA CAFÉ`.** No está en la lista de colores. Una de dos: se asigna Overo y se anota el color original, o se agrega "Overo café" al catálogo.

### 2.2 Fechas imposibles

- **L355, CSR-88 VALENTINA:** nació el 21/7/2026 y murió el 20/7/2026, un día antes. ¿Murió el 21/7, o nació muerta?
- **L110, CSR-274 JAPA** (nació 27/5/2025): su madre "62" es RANI (L131), vendida el 21/4/2025, un mes antes del parto. ¿La madre es otra, o la fecha de venta está mal?

### 2.3 Salidas sin fecha (32 animales)

El sistema guarda la salida sin fecha, pero conviene completarla si se conoce.

L4 (14 (2) ZEUS, vendido) · L48 (SA-266 CALVIN, vendido) · L49 (16-BR BUENA, vendida) · L50 (23 GUSTAVO, vendido) · L59 (120 FATIMA, vendida) · L79 (177 AKIL, degustación) · L152 (107 FLACO, muerto) · L172 (165 MARAVILHA, vendida) · L180 (117 PANCHO, vendido) · L182 (128 DANTE, intercambio) · L186 (140 (2) BOCA LLENA, muerta) · L191 (185 MAX, vendido) · L205 (CSR-502 CANELO, muerto) · L258 (40 CONSTANTINO, vendido) · L268 (98 EUDORA, vendida) · L272 (110 BELLATRIX, muerta) · L273 (110 (2) ARTEMIDIA, muerta) · L277 (115 GUERREIRA, muerta) · L278 (116 RAFAEL, muerto) · L283 (150 ELECTRA, muerta) · L286 (158 SERRA, muerto) · L288 (163 ZARA, muerta) · L289 (166 THORA, muerta) · L290 (167 VOLKAN, muerto) · L293 (174 INGRID, muerta) · L294 (175 ASTRID, muerta) · L298 (194 ARKAN, vendido) · L300 (199 COLOSSO, regalo) · L303 (202 SAGRADO, muerto) · L309 (216 VARQUIRIA, vendida) · L316 (CSR-24 DUQUE, muerto) · L386 (CSR-522 ORKO, muerta)

### 2.4 Aretes posiblemente mal escritos

- **L43, `CSRR-35` GLORIA:** ¿debería ser CSR-35? Ojo: en `Pesaje.csv` L1185 dice *"Anotado como CSR-629 (ABSID 248 = GLORIA)"*. ¿Cuál es su arete real?
- **L333, `CRS-54` DIAMANTINA:** ¿debería ser CSR-54?
- **L333, peso al nacer 0,75 kg:** muy bajo (murió a los 8 días); confirmar.

### 2.5 Aretes repetidos

El sistema los acepta como **caso especial**, pero conviene confirmar que son animales distintos:

- 14: L140 AFRODITA y L4 "14 (2)" ZEUS
- 34: L128 ESCARLATE y L175 "34 (2)" LEOPOLDINA
- 35: L229 HERDEIRA y L256 "35 (2)" EMPERADOR
- 110: L272 BELLATRIX y L273 "110 (2)" ARTEMIDIA
- 143: L65 CASTELA y L96 "143 (2)" ESPARTACO
- 208 / 0208: L81 MARCIA y L115 RIBI
- CSR-89: L42 BELEN y L356 "CSR-89 (2)" MAXIMILIANA

El "(2)" se importa como parte del arete, igual que en el Excel. Si el arete físico es otro, conviene corregirlo.

### 2.6 ABSID repetidos

**De compras (probablemente es el número de la otra cabaña):**

| ABSID | Animal de la cabaña | Animal comprado |
| --- | --- | --- |
| 64 | L136 0425 BIANCA | L135 CSR-280 ARROYO (El Arroyo) |
| 65 | L138 07 LEOA | L139 00239 SIAH (Canaan) |
| 68 | L142 58 MELISENDA | L143 00233 SAJAMA (Canaan) |
| 86 | L162 151 IMPERIAL | L161 303 ANDROMEDA (Perales) |
| 105 | L68 100 MAR | L69 69075 MAYA (Perales) |

**Dentro de la cabaña (uno de los dos está mal):**

- 04: L52 SA-4 ALFREDO y L53 17 FORTALEZA
- 115: L79 177 AKIL y L80 205 MARA
- 05 (caprinos): L56 132 CANELA y L57 122 ESTEFANY

Estos repetidos también impiden saber quién es la madre en 12 crías (ver 2.8).

### 2.7 Madre o padre imposible

Aquí la referencia apunta a un animal del sexo equivocado o que nació después que la cría:

| Línea | Cría | Dice | Problema |
| --- | --- | --- | --- |
| L43 | CSRR-35 GLORIA | madre 113 | 113 es TORRION, macho |
| L100 | CSR-159 IATE (nac. 4/8/2024) | madre 174 | 174 INGRID nació el 30/11/2024, después de la cría |
| L104 | CSR-191 JAJA | madre 142 | 142 es SUPREMO, macho |
| L160 | 147 ARENA | madre 10 | 10 es PEDRO, macho |
| L281 | 146 DRUSILA | madre 10 | 10 es PEDRO, macho |
| L182, L184, L208 | Boer 128 DANTE, 137 APOLO, 138 AGATA | madre 01 | ABSID 01 es ATLAS, macho y nacido después |
| L198, L220 | Boer 217 MORENA, CSR-507 MAEVE | madre 135 | No hay cabra 135 (135 es HERCULES, ovino). ¿Será 135 (2) HELENA? |

Si no se corrigen, se importan con un reproductor externo con esa referencia, o se dejan sin enlazar.

### 2.8 Madre ambigua

Hay dos hembras con ese número, porque el ABSID está repetido (2.6). Por fecha, el script elige la que ya estaba en la cabaña cuando nació la cría. Quedan sin resolver:

L93 CSR-09 CANELA (64) · L234 CSR-55 NATO (65) · L235 CSR-56 ABSOLUTO (105) · L238 CSR-62 RAINHA (86) · L242 CSR-68 DINASTIA (64) · L243 CSR-69 ASTRO (65) · L302 201 THOR (86) · L304 203 DIAMANTINO (65) · L324 CSR-37 SOL (68) · L330 CSR-38 COMENDADOR (68) · L359 CSR-91 ARTURO (86)

Lo más simple es escribir el **arete** de la madre en vez del número.

### 2.9 Madres y padres que no están en la planilla

Se cargan como **reproductores externos**. Confirmar que no se trata de un error de tipeo.

- **Padres:** 743, 669, 767, 547, 527, 1305, 3615, 600, 511, 6435, 769, B-11, "Bomar Superman", 111 (padre de los 6 PO: IATE, JOGO, JAJA, JANJA, JANETE, JAPA) y 110 (padre de OURO).
- **Madres:** 785, 185, 814, 3480, 615, 318, 619, 02 (YASMIN), 4174.

---

## 3. Revisar en el Excel — Pesajes

### 3.1 Pesajes después de la salida del animal (19)

El sistema no acepta pesar un animal que ya salió. Una de dos: la fecha de salida está mal, o el pesaje es de otro animal. **Si no se corrigen, esos pesajes no se cargan** y quedan listados en el reporte de importación.

| Línea | Arete | Pesaje | Salida en Animales |
| --- | --- | --- | --- |
| L131 | 17 FORTALEZA | 19/3/2025, 77 kg | muerta 15/12/2024 (además 77 kg es el peso de un carnero: ¿es otro animal?) |
| L458 | 29 DAMDARA | 17/9/2025 | vendida 2/9/2025 |
| L478 | 152 ESPARTA | 17/9/2025 | vendida 2/9/2025 |
| L754 | CSR-88 VALENTINA | 21/7/2026 | muerta 20/7/2026 (ver 2.2) |
| L895–L908 | CSR-30, CSR-38, CSR-57, CSR-58, CSR-75, CSR-78, CSR-81 | 3/9/2026 | vendidos 31/8/2026 |
| L1117–L1122 | 33 CANELA, 50 PIETRA, CSR-55 NATO, 59 DOMINIQUE, CSR-65 VALQUIRIA | 8/10/2026 | vendidos 23/9/2026 |
| L1120 | CSR-56 ABSOLUTO | 8/10/2026 | regalado 3/10/2026 |
| L1131 | 42 GLADIADOR | 7/10/2026 | regalado 21/1/2025 |
| L1133 | 06 NAIA | 7/10/2026 | muerta 25/11/2024 |

Los grupos del 31/8 y del 23/9 sugieren que **la venta se registró antes de que el animal saliera** del campo. Si es así, conviene poner como fecha de salida el día real.

### 3.2 Pesaje sin animal

- **L1292:** 51,6 kg, *"NO TIENE ARETE NI ABSID"*. No se puede cargar: no se sabe de qué animal es.

### 3.3 Pesos que no cuadran (alertas)

El sistema los acepta con una advertencia. Los más llamativos:

- **L811, 85 ELEONORA:** 35,2 kg (3/6/2026) → 10,2 kg (3/9/2026). Probablemente un error de tipeo (¿40,2?).
- **Destete del 11/02/2025 (L86–L118):** varios corderos de junio–julio de 2024 pesan 13–18 kg y 36 días después pesan 44 kg; por ejemplo, 91 SUEÑO, 95 SANG, 36 DÓLAR y 105 ANIBAL. Esa ganancia (700–850 g/día) es imposible. Revisar si ese día se anotaron pesos de otros corderos.
- **Pesajes del 3/9/2026 contra los del 10/9/2026:** 79 de las 84 ganancias imposibles son entre esas dos fechas. Muchos animales "ganan" 5 a 7 kg en una semana, y además el 3/9 bajan 12 animales respecto de junio. Lo más probable es que **todo el lote del 3/9/2026** esté mal: balanza descalibrada, animales en ayunas o pesos de otra planilla. ¿Se conserva, se descarta o se corrige?
- En total hay 49 bajadas de más del 15 % y 84 ganancias de más de 600 g/día. La lista completa está en el Anexo.

---

## 4. Revisar en el Excel — Registro sanitario

- **Sin fecha (4):** L95 14 (2), L96 10, L97 135 y L98 201, tratamiento de neumonía, *"Fecha no registrada"*. El sistema exige una fecha y la marca como **estimada**. ¿Qué fecha aproximada se pone?
- **Antes del nacimiento (2):** L196 CSR-74 JOJO y L197 CSR-76 COMANDANTE, desparasitados el 5/5/2026, pero nacieron el 7/5 y el 11/5. ¿Se quitan esas filas, o está mal la fecha de nacimiento?
- **"Vitamina + mineral + desparasitacion" (15 filas del 17/11/2025):** son dos aplicaciones. Propuesta: cargar dos eventos, uno de vitaminas y otro de desparasitación. ¿Con qué producto se desparasitó?
- **Productos:** para calcular el **período de retiro** (cuándo se puede vender la carne), el sistema necesita los días de retiro de cada producto. Hacen falta para: Vacuna clostridiosis, Doramectina, Olivitasan, *Calbendazol* (¿es Albendazol?) y Selenio. Si no se conocen, se cargan con 0 días.

---

## Anexo — Alertas de peso (lista completa)

### Bajadas de más del 15 % entre dos pesajes

- 26/GLORIA: L303 2025-08-22 52.4 → L462 2025-09-17 44 kg
- 90/MAGNIFICA: L690 2026-06-03 46.6 → L851 2026-09-03 38 kg
- 104/YASMIN: L695 2026-06-03 38.2 → L854 2026-09-03 31.8 kg
- 136/FRIDA: L711 2026-06-03 43.6 → L866 2026-09-03 37 kg
- 148/COQUETA: L341 2025-08-22 35 → L487 2025-09-17 28.8 kg
- 161/SOL: L1022 2026-09-10 51.8 → L1267 2026-10-08 41.6 kg
- 173/THOR: L93 2025-02-11 21.1 → L157 2025-04-10 17.1 kg
- 1994/RADIANTE: L311 2025-08-22 55 → L678 2026-06-03 43.6 kg
- 1988/CELESTE: L312 2025-08-22 48.4 → L468 2025-09-17 40.2 kg
- 2306/CATALINA: L314 2025-08-22 63.2 → L682 2026-06-03 46.8 kg
- 85/ELEONORA: L629 2026-06-03 35.2 → L811 2026-09-03 10.2 kg
- 48/ALTEZA: L346 2025-08-22 58.6 → L702 2026-06-03 35 kg
- 205/MARA: L637 2026-06-03 40 → L816 2026-09-03 31.2 kg
- 181/GAIA: L964 2026-09-10 48.8 → L1214 2026-10-08 39.8 kg
- CSR-06/NOBRE: L983 2026-09-10 48.8 → L1309 2026-10-08 29.8 kg
- 57/SAMARA: L222 2025-08-22 51.8 → L582 2026-06-03 40.6 kg
- 3050/EMPERATIZ: L228 2025-08-22 39.5 → L416 2025-09-17 27.4 kg
- 1614/REGINA: L587 2026-06-03 49.8 → L919 2026-09-10 42.2 kg
- 3010/RAFAELA: L234 2025-08-22 48.2 → L422 2025-09-17 40 kg
- 1880/CLARISA: L237 2025-08-22 59.6 → L592 2026-06-03 44.4 kg
- 1842/FIORELLA: L596 2026-06-03 49.2 → L788 2026-09-03 38.4 kg
- 1644/IVANA: L245 2025-08-22 49.2 → L599 2026-06-03 41.4 kg
- 16-BR/BUENA: L251 2025-08-22 54 → L430 2025-09-17 44.6 kg
- 122/ESTEFANY: L256 2025-08-22 58 → L622 2026-06-03 48.2 kg
- 129/TITA: L258 2025-08-22 56 → L624 2026-06-03 45 kg
- 129/TITA: L624 2026-06-03 45 → L808 2026-09-03 34.4 kg
- 129/TITA: L955 2026-09-10 41 → L1145 2026-10-07 28.2 kg
- 63/EUREA: L625 2026-06-03 46.8 → L809 2026-09-03 33.4 kg
- 3049/DOLORES: L985 2026-09-10 43 → L1115 2026-10-08 36.4 kg
- 0506/COROA: L841 2026-09-03 52.8 → L995 2026-09-10 43.2 kg
- 84/AKIRA: L294 2025-08-22 55.2 → L667 2026-06-03 45.8 kg
- 11/CHOCOLATE: L455 2025-09-17 56 → L668 2026-06-03 46.2 kg
- 22/MIEL: L298 2025-08-22 48 → L671 2026-06-03 39 kg
- 12/DIVINDADE: L304 2025-08-22 61.6 → L673 2026-06-03 50.4 kg
- 0425/BIANCA: L681 2026-06-03 62 → L847 2026-09-03 51.2 kg
- 14/AFRODITA: L316 2025-08-22 52.4 → L471 2025-09-17 43 kg
- 192/SAHARA: L317 2025-08-22 75.4 → L472 2025-09-17 62.4 kg
- 192/SAHARA: L472 2025-09-17 62.4 → L686 2026-06-03 52 kg
- 0287/MAJESTAD: L319 2025-08-22 43.6 → L474 2025-09-17 35 kg
- 119/PATA SECA: L350 2025-08-22 108 → L705 2026-06-03 88.2 kg
- 126/MARIA: L706 2026-06-03 58 → L861 2026-09-03 47.8 kg
- 133/SUSU: L355 2025-08-22 53 → L708 2026-06-03 41.8 kg
- 134/ZOE: L1039 2026-09-10 66 → L1158 2026-10-07 49.8 kg
- 33/CANELA: L493 2025-09-17 54 → L725 2026-06-03 44.6 kg
- 33/CANELA: L1056 2026-09-10 42.8 → L1117 2026-10-08 34.2 kg
- 59/DOMINIQUE: L386 2025-08-22 53.2 → L495 2025-09-17 36 kg
- CSR-33/DAKOTA: L604 2026-06-03 28.4 → L793 2026-09-03 23.4 kg
- CSR-42/REAL: L945 2026-09-10 41.8 → L1308 2026-10-08 28.5 kg
- CSR-159/IATE: L654 2026-06-03 100.4 → L831 2026-09-03 49.8 kg

### Ganancias de más de 600 g/día

- 91/SUEÑO: L96 2025-02-11 13.32 → L139 2025-03-19 44 kg (852 g/día)
- 95/SANG: L94 2025-02-11 17.55 → L137 2025-03-19 44.5 kg (749 g/día)
- 97/ESTRELLA: L850 2026-09-03 43.8 → L1020 2026-09-10 49.2 kg (771 g/día)
- 90/MAGNIFICA: L851 2026-09-03 38 → L1021 2026-09-10 42.2 kg (600 g/día)
- 36/DÓLAR: L97 2025-02-11 18.35 → L141 2025-03-19 44 kg (713 g/día)
- 105/ANIBAL: L95 2025-02-11 17.5 → L138 2025-03-19 44 kg (736 g/día)
- 138/AGATA: L867 2026-09-03 48.2 → L1042 2026-09-10 54 kg (829 g/día)
- 135 (2)/HELENA: L865 2026-09-03 45.2 → L1040 2026-09-10 51 kg (829 g/día)
- 136/FRIDA: L866 2026-09-03 37 → L1041 2026-09-10 43 kg (857 g/día)
- 106/ODESSA: L857 2026-09-03 44.6 → L1032 2026-09-10 50.2 kg (800 g/día)
- 148/COQUETA: L856 2026-09-03 48 → L1029 2026-09-10 54.8 kg (971 g/día)
- 153/ATENEA: L812 2026-09-03 34.6 → L963 2026-09-10 39.4 kg (686 g/día)
- 303/ANDROMEDA: L853 2026-09-03 68.8 → L1024 2026-09-10 75 kg (886 g/día)
- 183/MOCHI: L869 2026-09-03 29.2 → L1044 2026-09-10 35 kg (829 g/día)
- 85/ELEONORA: L811 2026-09-03 10.2 → L960 2026-09-10 37.2 kg (3857 g/día)
- 189/MILA: L870 2026-09-03 33.2 → L1045 2026-09-10 37.8 kg (657 g/día)
- 193/CARTAGENA: L815 2026-09-03 46.8 → L965 2026-09-10 52.6 kg (829 g/día)
- 195/CACHIRULA: L790 2026-09-03 36 → L933 2026-09-10 42.2 kg (886 g/día)
- 198/APOLO: L818 2026-09-03 75 → L969 2026-09-10 79.6 kg (657 g/día)
- 205/MARA: L816 2026-09-03 31.2 → L967 2026-09-10 35.8 kg (657 g/día)
- 208/MARCIA: L817 2026-09-03 43.6 → L968 2026-09-10 51 kg (1057 g/día)
- CSR-89/BELEN: L802 2026-09-03 37.6 → L946 2026-09-10 43 kg (771 g/día)
- 209/ERBACIO: L871 2026-09-03 40.2 → L1046 2026-09-10 48.2 kg (1143 g/día)
- CSR-05/DIVA: L827 2026-09-03 37.8 → L980 2026-09-10 44.2 kg (914 g/día)
- CSR-06/NOBRE: L830 2026-09-03 41.6 → L983 2026-09-10 48.8 kg (1029 g/día)
- 13/EUSA: L781 2026-09-03 46 → L912 2026-09-10 51.2 kg (743 g/día)
- 57/SAMARA: L782 2026-09-03 43 → L913 2026-09-10 49.2 kg (886 g/día)
- 1702/HERMELINDA: L783 2026-09-03 45.2 → L920 2026-09-10 50 kg (686 g/día)
- 3018/CANA: L785 2026-09-03 38.8 → L922 2026-09-10 46.4 kg (1086 g/día)
- 1842/FIORELLA: L788 2026-09-03 38.4 → L928 2026-09-10 46.4 kg (1143 g/día)
- 1641/KALI: L789 2026-09-03 51.6 → L929 2026-09-10 61.4 kg (1400 g/día)
- 131/LUNA: L806 2026-09-03 69 → L951 2026-09-10 74.8 kg (829 g/día)
- 129/TITA: L808 2026-09-03 34.4 → L955 2026-09-10 41 kg (943 g/día)
- 63/EUREA: L809 2026-09-03 33.4 → L956 2026-09-10 38.9 kg (786 g/día)
- 10/PEDRO: L810 2026-09-03 80.2 → L957 2026-09-10 86.6 kg (914 g/día)
- 3049/DOLORES: L832 2026-09-03 32.6 → L985 2026-09-10 43 kg (1486 g/día)
- 3048/BRAVURA: L835 2026-09-03 42.6 → L989 2026-09-10 48.8 kg (886 g/día)
- 1329/AGATA: L837 2026-09-03 39.6 → L991 2026-09-10 46 kg (914 g/día)
- 84/AKIRA: L997 2026-09-10 52.8 → L1227 2026-10-08 84 kg (1114 g/día)
- 76/MAJESTOSA: L845 2026-09-03 44.2 → L1002 2026-09-10 49 kg (686 g/día)
- 0425/BIANCA: L847 2026-09-03 51.2 → L1012 2026-09-10 57.4 kg (886 g/día)
- 07/LEOA: L848 2026-09-03 63.8 → L1014 2026-09-10 72.8 kg (1286 g/día)
- 14/AFRODITA: L849 2026-09-03 40 → L1016 2026-09-10 46 kg (857 g/día)
- 118/TORETO: L859 2026-09-03 70.8 → L1034 2026-09-10 79.8 kg (1286 g/día)
- 126/MARIA: L861 2026-09-03 47.8 → L1036 2026-09-10 54.2 kg (914 g/día)
- 130/CARMEN: L862 2026-09-03 52 → L1037 2026-09-10 56.6 kg (657 g/día)
- 133/SUSU: L863 2026-09-03 40.4 → L1038 2026-09-10 49 kg (1229 g/día)
- 134/ZOE: L864 2026-09-03 57.6 → L1039 2026-09-10 66 kg (1200 g/día)
- CSR-09/CANELA: L826 2026-09-03 39.2 → L979 2026-09-10 44.8 kg (800 g/día)
- CSR-13/SARITA: L824 2026-09-03 36.6 → L977 2026-09-10 42.2 kg (800 g/día)
- CSR-14/ASTRO: L876 2026-09-03 40.6 → L1052 2026-09-10 46.2 kg (800 g/día)
- CSR-16/MONARCA: L828 2026-09-03 47.8 → L981 2026-09-10 52.2 kg (629 g/día)
- CSR-20/PANELA: L825 2026-09-03 38.6 → L978 2026-09-10 45.2 kg (943 g/día)
- CSR-19/DESTEMIDA: L878 2026-09-03 28.6 → L1054 2026-09-10 36.2 kg (1086 g/día)
- CSR-18/BRUT: L894 2026-09-03 40.6 → L1074 2026-09-10 46.2 kg (800 g/día)
- CSR-25/ELITE: L799 2026-09-03 44.4 → L943 2026-09-10 49.4 kg (714 g/día)
- CSR-33/DAKOTA: L793 2026-09-03 23.4 → L936 2026-09-10 34.6 kg (1600 g/día)
- CSR-42/REAL: L801 2026-09-03 36.2 → L945 2026-09-10 41.8 kg (800 g/día)
- CSR-45/DOM: L796 2026-09-03 37.7 → L940 2026-09-10 43 kg (757 g/día)
- CSR-46/DONO: L800 2026-09-03 37.8 → L944 2026-09-10 43.4 kg (800 g/día)
- CSR-51/VENCEDOR: L829 2026-09-03 42 → L982 2026-09-10 49.8 kg (1114 g/día)
- CSR-53/OURO: L797 2026-09-03 38.2 → L941 2026-09-10 44.2 kg (857 g/día)
- CSR-55/NATO: L880 2026-09-03 21.6 → L1058 2026-09-10 26 kg (629 g/día)
- CSR-56/ABSOLUTO: L881 2026-09-03 24 → L1059 2026-09-10 30.2 kg (886 g/día)
- CSR-59/PRECIOSA: L882 2026-09-03 25.2 → L1061 2026-09-10 30 kg (686 g/día)
- CSR-61/AMATISTA: L794 2026-09-03 29 → L938 2026-09-10 35.2 kg (886 g/día)
- CSR-64/PEPON: L795 2026-09-03 41 → L939 2026-09-10 48.2 kg (1029 g/día)
- CSR-62/RAINHA: L883 2026-09-03 26.2 → L1062 2026-09-10 32 kg (829 g/día)
- CSR-69/ASTRO: L888 2026-09-03 24.2 → L1067 2026-09-10 31.8 kg (1086 g/día)
- CSR-71/BELLONA: L889 2026-09-03 24.6 → L1068 2026-09-10 30.6 kg (857 g/día)
- CSR-73/REI: L900 2026-09-03 32 → L1076 2026-09-10 37.2 kg (743 g/día)
- CSR-76/COMANDANTE: L892 2026-09-03 15.2 → L1071 2026-09-10 20.4 kg (743 g/día)
- CSR-508/LUCIANA: L903 2026-09-03 18 → L1079 2026-09-10 22.6 kg (657 g/día)
- CSR-80/HERA: L907 2026-09-03 17.6 → L1081 2026-09-10 23.2 kg (800 g/día)
- CSRR-35/GLORIA: L803 2026-09-03 48 → L947 2026-09-10 53 kg (714 g/día)
- CSR-159/IATE: L831 2026-09-03 49.8 → L984 2026-09-10 106 kg (8029 g/día)
- CSR-183/JOGO: L833 2026-09-03 83.6 → L987 2026-09-10 90.2 kg (943 g/día)
- CSR-191/JAJA: L834 2026-09-03 87.6 → L988 2026-09-10 92.4 kg (686 g/día)
- CSR-264/JANJA: L838 2026-09-03 54.2 → L992 2026-09-10 60.8 kg (943 g/día)
- CSR-272/JANETE: L839 2026-09-03 55.4 → L993 2026-09-10 61.2 kg (829 g/día)
- CSR-63/VALIOSA: L884 2026-09-03 23.8 → L1063 2026-09-10 29.8 kg (857 g/día)
- CSR-65/VALQUIRIA: L885 2026-09-03 23.6 → L1064 2026-09-10 30.4 kg (971 g/día)
- CSR-66/MAXIMUS: L886 2026-09-03 23.6 → L1065 2026-09-10 29 kg (771 g/día)
- 264/DIABLO: L873 2026-09-03 48.8 → L1048 2026-09-10 53.2 kg (629 g/día)
