"use client";
import { SignInButton } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";
import { ArrowIcon } from "./icons";
export default function Welcome() {
  return (
    <section className="welcome">
      <div className="eyebrow">PRE OPRAVOVATEĽOV</div>
      <h1>
        Riešenia na jednom mieste.
        <br />
        Spätná väzba priamo v PDF.
      </h1>
      <p>
        Importujte ZIP, podeľte sa o opravovanie a odovzdajte hodnotené riešenia
        v pôvodnom formáte.
      </p>
      <SignInButton mode="modal">
        <button className="primary large">
          Prihlásiť sa a začať <ArrowIcon />
        </button>
      </SignInButton>
      <div className="welcomefoot">
        <ShieldCheck size={18} /> Projekty dostupné len vám a vašim
        spolupracovníkom.
      </div>
    </section>
  );
}
