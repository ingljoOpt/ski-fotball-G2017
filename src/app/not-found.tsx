import { AppLink, Card } from "./ui";

export default function NotFound() {
  return <Card className="app-card narrow"><h1>Siden er ikke tilgjengelig</h1><p>Siden finnes ikke, eller du har ikke tilgang til den.</p><AppLink href="/oversikt">Til klubboversikten</AppLink></Card>;
}
