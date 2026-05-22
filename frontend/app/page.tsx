import WalletConnect from "@/components/WalletConnect";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold text-blue-400 mb-4">
          TalentChain
        </h1>
        <p className="text-xl text-slate-300 mb-8">
          Dezentrale Recruiting-Plattform auf Cardano Blockchain
        </p>
        <div className="bg-slate-800 rounded-xl p-6 mb-6">
          <p className="text-green-400 font-mono text-sm">
            ✓ Netzwerk: Cardano Preprod Testnet
          </p>
        </div>
        <WalletConnect />
      </div>
    </main>
  );
}