export default function BookingPaidPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const isRemainder = searchParams.type === "remainder";

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0a0d14" }}>
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">✅</div>
        <h1 className="text-2xl font-bold text-white mb-3">Betalning mottagen!</h1>
        <p className="text-gray-400 text-base leading-relaxed">
          {isRemainder
            ? "Tack! Din slutbetalning är registrerad. Vi ser fram emot ditt besök."
            : "Tack! Din handpenning på 20% är betald. Du får en påminnelse om slutbetalning 14 dagar innan incheckning."}
        </p>
      </div>
    </div>
  );
}
