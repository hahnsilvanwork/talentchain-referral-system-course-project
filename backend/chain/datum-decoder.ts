/**
 * datum-decoder.ts
 * ─────────────────────────────────────────────────────────────────
 * Dekodiert Plutus Data CBOR (Inline Datum) zu einem JSON-Objekt
 * das dem Blockfrost json_value Format entspricht:
 *
 *   { constructor: N, fields: [...] }
 *   { bytes: "hex" }
 *   { int: N }
 *   { list: [...] }
 *   { map: [...] }
 *
 * Genutzt wenn Blockfrost kein inline_datum als JSON liefert
 * sondern nur das rohe CBOR hex.
 */

/**
 * Dekodiert CBOR hex zu Plutus Data JSON (Blockfrost Format).
 * Gibt null zurück wenn Dekodierung fehlschlägt.
 */
export function decodeDatum(cborHex: string): any {
  // Wir nutzen @emurgo/cardano-serialization-lib-nodejs
  // CSL.PlutusData.from_hex() → dann zu JSON konvertieren
  try {
    const CSL = require("@emurgo/cardano-serialization-lib-nodejs");
    const plutusData = CSL.PlutusData.from_hex(cborHex);
    return plutusDataToJson(plutusData);
  } catch (e) {
    console.error("CBOR Decode Fehler:", e);
    return null;
  }
}

function plutusDataToJson(data: any): any {
  // PlutusData kann sein: ConstrPlutusData, PlutusMap, PlutusList, BigNum, Bytes
  try {
    // Versuch als Constr (Constructor)
    const constr = data.as_constr_plutus_data?.();
    if (constr) {
      const alt = constr.alternative().to_str();
      const fields = constr.data();
      const fieldList: any[] = [];
      for (let i = 0; i < fields.len(); i++) {
        fieldList.push(plutusDataToJson(fields.get(i)));
      }
      return { constructor: parseInt(alt), fields: fieldList };
    }
  } catch {}

  try {
    // Bytes
    const bytes = data.as_bytes?.();
    if (bytes) {
      return { bytes: Buffer.from(bytes).toString("hex") };
    }
  } catch {}

  try {
    // Integer
    const int = data.as_integer?.();
    if (int) {
      return { int: parseInt(int.to_str()) };
    }
  } catch {}

  try {
    // List
    const list = data.as_list?.();
    if (list) {
      const items: any[] = [];
      for (let i = 0; i < list.len(); i++) {
        items.push(plutusDataToJson(list.get(i)));
      }
      return { list: items };
    }
  } catch {}

  try {
    // Map
    const map = data.as_map?.();
    if (map) {
      const keys = map.keys();
      const entries: any[] = [];
      for (let i = 0; i < keys.len(); i++) {
        const k = keys.get(i);
        entries.push({
          k: plutusDataToJson(k),
          v: plutusDataToJson(map.get(k)),
        });
      }
      return { map: entries };
    }
  } catch {}

  return null;
}