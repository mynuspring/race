export default function Pending() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center">
      <h1 className="mb-2 text-lg font-semibold">Waiting for access</h1>
      <p className="text-sm text-gray-600">Your account is set up. An admin needs to give you a role (sales or ads) before you can enter data or see the dashboard.</p>
    </div>
  );
}
