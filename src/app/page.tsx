export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900 flex items-center justify-center px-6">
      <section className="text-center max-w-3xl">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 text-green-700">
          Jenkins Home & Property Solutions
        </h1>

        <p className="text-xl md:text-2xl mb-8 text-gray-600">
          Lawn Care • Pressure Washing • Junk Removal • Land Clearing • Cleanups
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="tel:4076869817"
            className="bg-green-700 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-green-800 transition"
          >
            Call / Text 407-686-9817
          </a>

          <a
            href="mailto:FRLawnCareFL@gmail.com"
            className="border border-green-700 text-green-700 px-8 py-4 rounded-xl text-lg font-semibold hover:bg-green-50 transition"
          >
            Free Estimate (Email)
          </a>
        </div>

        <div className="mt-10 text-gray-500">
          <p className="font-medium">Licensed & Insured • Central Florida</p>
          <p className="mt-2">Weekly contracts available • Starting around $30 for average yards</p>
        </div>
      </section>
    </main>
  );
}
