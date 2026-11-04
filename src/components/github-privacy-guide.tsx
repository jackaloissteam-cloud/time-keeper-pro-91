import { ExternalLink, Github, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const repositoryUrl = "https://github.com/jackaloissteam-cloud/time-keeper-pro-91";
const documentationUrl = "https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility";

export function GithubPrivacyGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Github /> GitHub: privat stellen
        </Button>
      </DialogTrigger>
      <DialogContent className="no-print max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg p-5 sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="flex items-center gap-2 leading-snug"><LockKeyhole className="size-5 shrink-0" /> GitHub-Repository auf privat ändern</DialogTitle>
          <DialogDescription className="break-words">jackaloissteam-cloud / time-keeper-pro-91</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">Diese Anleitung ändert nichts automatisch. Die Umstellung erfolgt in GitHub und betrifft den Quellcode, nicht die Sichtbarkeit der veröffentlichten App.</p>

        <section className="space-y-2 text-sm" aria-labelledby="github-privacy-steps">
          <h2 id="github-privacy-steps" className="font-semibold">Schritt für Schritt</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Bei GitHub mit einem Konto anmelden, das Administratorrechte für dieses Repository hat. Eine Organisation kann die Änderung ihren Eigentümern vorbehalten.</li>
            <li>Das Repository öffnen und <strong>Settings</strong> (Einstellungen) wählen. Auf kleinen Bildschirmen liegt der Reiter eventuell im Menü.</li>
            <li>Unter <strong>General</strong> ganz nach unten zu <strong>Danger Zone</strong> scrollen.</li>
            <li>Bei <strong>Change repository visibility</strong> auf <strong>Change visibility</strong> klicken und <strong>Make private</strong> auswählen.</li>
            <li>GitHubs Hinweise lesen und den Bestätigungen folgen. Falls verlangt, den Repository-Namen eingeben. Erst die abschließende Bestätigung stellt auf privat um.</li>
            <li>Danach muss neben dem Repository-Namen <strong>Private</strong> stehen. Den Link in einem privaten Browserfenster ohne GitHub-Anmeldung prüfen: Der Code darf dort nicht mehr sichtbar sein; GitHub zeigt häufig „404“.</li>
          </ol>
          <Button asChild variant="outline" className="mt-2 h-auto min-h-10 whitespace-normal text-left">
            <a href={`${repositoryUrl}/settings`} target="_blank" rel="noopener noreferrer"><ExternalLink /> GitHub-Einstellungen öffnen</a>
          </Button>
        </section>

        <section className="space-y-2 border-t border-border pt-4 text-sm" aria-labelledby="github-privacy-access">
          <h2 id="github-privacy-access" className="font-semibold">Wer hat danach Zugriff?</h2>
          <dl className="space-y-3">
            <div><dt className="font-medium">Quellcode auf GitHub</dt><dd className="text-muted-foreground">Nur berechtigte GitHub-Konten können Code, README und Repository-Dateien ansehen oder herunterladen. Bestehende berechtigte Personen behalten ihren Zugriff; bei Organisationen zählen auch Team- und Grundeinstellungen.</dd></div>
            <div><dt className="font-medium">Kollegen, die am Code arbeiten</dt><dd className="text-muted-foreground">Unter Settings → Collaborators bzw. Collaborators and teams / Manage access gezielt einladen und passende Rechte vergeben. Die Einladung muss angenommen werden. Für reine App-Nutzer ist keine GitHub-Einladung nötig.</dd></div>
            <div><dt className="font-medium">Kollegen, die nur den Stundenzettel nutzen</dt><dd className="text-muted-foreground">Der veröffentlichte Lovable-Link bleibt durch diese GitHub-Änderung unverändert erreichbar. Seine Zugriffsrechte werden separat in Lovable festgelegt. Ein privates Repository macht die App nicht automatisch privat.</dd></div>
            <div><dt className="font-medium">Persönliche Stundenzettel</dt><dd className="text-muted-foreground">Einträge und Suchverlauf bleiben getrennt im jeweiligen Browser auf dem jeweiligen Gerät. Sie werden nicht durch diese Umstellung auf GitHub hochgeladen oder mit Kollegen geteilt.</dd></div>
          </dl>
        </section>

        <section className="space-y-2 border-t border-border pt-4 text-sm" aria-labelledby="github-privacy-consequences">
          <h2 id="github-privacy-consequences" className="font-semibold">Wichtige Folgen und Kontrolle</h2>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Bereits heruntergeladene Kopien bleiben erhalten. Öffentliche Forks bleiben öffentlich und werden vom Repository getrennt. Privatstellen macht früher veröffentlichten Code nicht rückwirkend geheim.</li>
            <li>Stars und Watcher werden entfernt. Einige GitHub-Funktionen hängen bei privaten Repositorys vom Tarif ab. Falls GitHub Pages genutzt wird: Bei GitHub Free wird diese Website unveröffentlicht. Das betrifft nicht den Lovable-App-Link.</li>
            <li>Lovable unterstützt private GitHub-Repositorys. Die GitHub-Verbindung muss weiterhin Zugriff haben. Danach in Lovable unter Projekteinstellungen → Git den Status prüfen und die nächste Änderung auf GitHub kontrollieren. Nicht vorsorglich trennen: Eine erneute Verbindung erstellt ein neues Repository.</li>
          </ul>
          <p className="text-muted-foreground">Der aktuelle GitHub-Status wird in dieser Anleitung nicht live geprüft.</p>
          <a href={documentationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 text-primary underline underline-offset-4">Offizielle GitHub-Anleitung <ExternalLink className="size-4 shrink-0" /></a>
        </section>
      </DialogContent>
    </Dialog>
  );
}