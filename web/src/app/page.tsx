import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900">
      <div className="p-8 bg-white rounded-xl shadow-md text-center max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">School Expert</h1>
        <p className="text-gray-600 mb-6">La página principal (landing page) está en construcción.</p>
        
        <Link 
          href="/login" 
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Ir al Sistema (Login)
        </Link>
      </div>
    </div>
  );
}
