import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Welcome to HypeHire
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            The modern staffing platform connecting talented workers with
            companies that need them.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/login"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-500 transition"
            >
              Get Started
            </Link>
            <Link
              href="#features"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition"
            >
              Learn More
            </Link>
          </div>

          <div id="features" className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-3">For Workers</h3>
              <p className="text-gray-600">
                Find flexible shifts that match your schedule and skills.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-3">For Companies</h3>
              <p className="text-gray-600">
                Access qualified staff on-demand when you need them most.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-semibold mb-3">Instant Matching</h3>
              <p className="text-gray-600">
                Our platform connects the right people at the right time.
              </p>
            </div>
          </div>

          <div className="mt-16 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-blue-600 underline">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
