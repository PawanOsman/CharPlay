export default function CharacterLayout({ children }: { children: React.ReactNode }) {
  // Character pages render without the global site header/footer chrome
  return <>{children}</>;
}


