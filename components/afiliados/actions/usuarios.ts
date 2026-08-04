"use server";

import { createClient } from "@/utils/supabase/server";
import supabaseAdmin from "@/utils/supabase/admin";

type ConteoPorLider = {
  total: number;
  titulares: number;
  familiares: number;
};

type RpcConteoRow = {
  lider_id: string;
  total: number;
  titulares: number;
  familiares: number;
};

const TAM_PAGINA_CONTEO_AFILIADOS = 1000;

async function conteosAfiliadosPorLiderMap(): Promise<
  Map<string, ConteoPorLider>
> {
  const conteoMap = new Map<string, ConteoPorLider>();

  const rpcRes = await supabaseAdmin.rpc("conteos_afiliados_por_lider");

  if (!rpcRes.error && Array.isArray(rpcRes.data)) {
    (rpcRes.data as RpcConteoRow[]).forEach((row) => {
      if (!row.lider_id) return;
      conteoMap.set(row.lider_id, {
        total: Number(row.total) || 0,
        titulares: Number(row.titulares) || 0,
        familiares: Number(row.familiares) || 0,
      });
    });
    return conteoMap;
  }

  if (rpcRes.error) {
    console.error(
      "RPC conteos_afiliados_por_lider no disponible, usando paginación:",
      rpcRes.error.message,
    );
  }

  let desde = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("afiliados")
      .select("lider_id, familiar_de")
      .range(desde, desde + TAM_PAGINA_CONTEO_AFILIADOS - 1);

    if (error) throw new Error(error.message);

    const filas = data ?? [];
    if (!filas.length) break;

    filas.forEach((row) => {
      if (!row.lider_id) return;
      const actual = conteoMap.get(row.lider_id) ?? {
        total: 0,
        titulares: 0,
        familiares: 0,
      };
      actual.total += 1;
      if (row.familiar_de) actual.familiares += 1;
      else actual.titulares += 1;
      conteoMap.set(row.lider_id, actual);
    });

    if (filas.length < TAM_PAGINA_CONTEO_AFILIADOS) break;
    desde += TAM_PAGINA_CONTEO_AFILIADOS;
  }

  return conteoMap;
}

export async function listarUsuariosAction(rol_filtro?: string | string[]) {
  const supabase = await createClient();

  const queryPerfiles = supabase
    .from("info_perfil")
    .select(`
      user_id, 
      nombres, 
      apellidos, 
      activo, 
      rol_id,
      nivel_compromiso,
      roles!inner ( id, nombre )
    `)
    .order("nombres", { ascending: true });

  let filtroPerfiles = queryPerfiles;

  if (rol_filtro) {
    if (Array.isArray(rol_filtro)) {
      filtroPerfiles = queryPerfiles.in("roles.nombre", rol_filtro);
    } else {
      filtroPerfiles = queryPerfiles.eq("roles.nombre", rol_filtro);
    }
  }

  const [perfilesRes, authRes, conteoMap] = await Promise.all([
    filtroPerfiles,
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }).catch(() => ({ data: { users: [] } })),
    conteosAfiliadosPorLiderMap(),
  ]);

  if (perfilesRes.error) throw new Error(perfilesRes.error.message);

  const perfiles = perfilesRes.data || [];
  const users = (authRes as any)?.data?.users || [];

  const userMap = new Map(users.map((u: any) => [u.id, u.email]));

  return perfiles.map((p: any) => ({
    id: p.user_id,
    email: (userMap.get(p.user_id) as string)?.replace(/@.*$/, "") || "",
    nombres: p.nombres,
    apellidos: p.apellidos,
    activo: p.activo,
    rol: p.roles?.nombre,
    rol_id: p.rol_id,
    nivel_compromiso: p.nivel_compromiso,
    conteoAfiliados: conteoMap.get(p.user_id)?.total || 0,
    conteoTitulares: conteoMap.get(p.user_id)?.titulares || 0,
    conteoFamiliares: conteoMap.get(p.user_id)?.familiares || 0,
  }));

}
