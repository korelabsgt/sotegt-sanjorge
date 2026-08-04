"use server";

import { createClient } from "@/utils/supabase/server";
import supabaseAdmin from "@/utils/supabase/admin";

export async function obtenerAfiliadosAction(liderId?: string) {
  const supabase = await createClient();

  let query = supabase.from("afiliados").select("*");

  if (liderId) {
    query = query.eq("lider_id", liderId);
  }

  const { data: afiliados, error } = await query.order("created_at", {
    ascending: true,
  });

  if (error) throw new Error(error.message);
  if (!afiliados) return [];

  const liderIds = [
    ...new Set(afiliados.map((a) => a.lider_id).filter((id) => id)),
  ];
  const lugarIds = [
    ...new Set(afiliados.map((a) => a.lugar_id).filter((id) => id)),
  ];

  // Ejecución en paralelo de las consultas de apoyo
  const [perfilesRes, lugaresRes, politicasRes, subPoliticasRes, sectoresRes] = await Promise.all([
    liderIds.length > 0
      ? supabase
          .from("info_perfil")
          .select("user_id, nombres, apellidos")
          .in("user_id", liderIds)
      : { data: [] },

    lugarIds.length > 0
      ? supabase.from("lugares").select("id, nombre, sector_id").in("id", lugarIds)
      : { data: [] },

    supabase.from("sis_politicas").select("id, nombre"),
    supabase.from("sis_politicas_sub").select("id, nombre"),
    supabase.from("sectores").select("id, nombre"),
  ]);

  const perfiles = perfilesRes.data || [];
  const lugares = lugaresRes.data || [];
  const politicas = politicasRes.data || [];
  const subPoliticas = subPoliticasRes.data || [];
  const sectores = sectoresRes.data || [];

  const perfilMap = new Map(perfiles.map((p: any) => [p.user_id, p]));
  const lugarMap = new Map(lugares.map((l: any) => [l.id, l.nombre]));
  const lugarSectorMap = new Map(lugares.map((l: any) => [l.id, l.sector_id]));
  const sectorMap = new Map(sectores.map((s: any) => [s.id, s.nombre]));
  const politicaMap = new Map(politicas.map((p: any) => [p.id, p.nombre]));
  const subPoliticaMap = new Map(subPoliticas.map((sp: any) => [sp.id, sp.nombre]));

  return afiliados.map((afiliado: any) => {
    const perfilLider = afiliado.lider_id
      ? perfilMap.get(afiliado.lider_id)
      : null;

    const sectorId = afiliado.lugar_id ? lugarSectorMap.get(afiliado.lugar_id) : null;

    return {
      ...afiliado,
      lugar_nombre: afiliado.lugar_id
        ? lugarMap.get(afiliado.lugar_id) || null
        : null,
      sector_nombre: sectorId ? sectorMap.get(sectorId) || null : null,
      sector_id: sectorId || null,
      politica: afiliado.politica_id 
        ? politicaMap.get(afiliado.politica_id) 
        : afiliado.politica,
      sub_politica: afiliado.sub_politica_id
        ? subPoliticaMap.get(afiliado.sub_politica_id)
        : afiliado.sub_politica || null,
      lider_nombre: perfilLider
        ? `${perfilLider.nombres} ${perfilLider.apellidos}`
        : "Sin Líder",
      lider_email: "",
    };
  });
}

export async function obtenerTotalAfiliadosAction() {
  const { count, error } = await supabaseAdmin
    .from("afiliados")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error al obtener total de afiliados:", error);
    return 0;
  }
  return count ?? 0;
}

export async function obtenerConteoPadronAction() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("padron_tse")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error al obtener conteo del padrón:", error);
    return 0;
  }
  return count || 0;
}

export async function obtenerReligionesUnicasAction() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("afiliados")
    .select("religion");

  if (error) {
    console.error("Error al obtener religiones:", error);
    return [];
  }
  const uniq = Array.from(new Set(data.map((d: any) => d.religion).filter(Boolean)));
  return uniq.filter(r => r !== "Católico" && r !== "Evangélico");
}
