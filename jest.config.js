/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  moduleNameMapper: {
    '^@expo/vector-icons$': '<rootDir>/src/__mocks__/vector-icons.tsx',
    '^@expo/vector-icons/(.*)$': '<rootDir>/src/__mocks__/vector-icons.tsx',
    '^@react-native-async-storage/async-storage$': '<rootDir>/src/__mocks__/async-storage.ts',
    '^react-native$': '<rootDir>/src/__mocks__/react-native.ts',
    '^expo-clipboard$': '<rootDir>/src/__mocks__/expo-clipboard.ts',
    '^expo-print$': '<rootDir>/src/__mocks__/expo-print.ts',
    '^expo-sharing$': '<rootDir>/src/__mocks__/expo-sharing.ts',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/__mocks__/fileMock.ts'
  },
  modulePathIgnorePatterns: ['<rootDir>/functions/']
};
