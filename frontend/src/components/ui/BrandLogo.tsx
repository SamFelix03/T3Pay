import Image from "next/image";

type Props = {
  variant?: "nav" | "hero" | "card";
  className?: string;
};

export function BrandLogo({ variant = "nav", className = "" }: Props) {
  const isHero = variant === "hero";
  const isCard = variant === "card";
  return (
    <Image
      src="/logo.png"
      alt="T3Pay"
      width={isHero ? 200 : isCard ? 120 : 176}
      height={isHero ? 56 : isCard ? 34 : 48}
      className={`brand-logo-image ${isHero ? "hero" : isCard ? "card" : "nav"} ${className}`.trim()}
      priority={isHero || isCard}
    />
  );
}
