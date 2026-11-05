export { Account } from "./account-menu";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function Notices({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return (
    <>
      {typeof params.feil === "string" && <p className="notice error" role="alert">{params.feil}</p>}
      {typeof params.melding === "string" && <p className="notice" role="status">{params.melding}</p>}
    </>
  );
}
