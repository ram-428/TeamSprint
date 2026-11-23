/** @type {import('next').NextConfig} */
export default {
  serverExternalPackages: ['mongoose', 'mongodb-memory-server', 'bcryptjs'],
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: false },
};
