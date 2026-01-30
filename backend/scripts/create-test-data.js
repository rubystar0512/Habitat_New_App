require('dotenv').config();
const { sequelize } = require('../config/database');
const {
  User,
  GitRepo,
  Commit,
  CommitFile,
  UserHabitatAccount,
  Reservation,
  MemoCommit,
  SuccessfulTask
} = require('../models');
const bcrypt = require('bcryptjs');

const createTestData = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Create admin user
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const [admin, adminCreated] = await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        username: 'admin',
        email: 'admin@habitate.com',
        passwordHash: adminPasswordHash,
        role: 'admin',
        isApproved: true
      }
    });
    console.log(adminCreated ? '✅ Admin user created' : 'ℹ️  Admin user already exists');

    // Create test user
    const userPasswordHash = await bcrypt.hash('password123', 10);
    const [testUser, userCreated] = await User.findOrCreate({
      where: { username: 'testuser' },
      defaults: {
        username: 'testuser',
        email: 'testuser@example.com',
        passwordHash: userPasswordHash,
        role: 'user',
        isApproved: true
      }
    });
    console.log(userCreated ? '✅ Test user created' : 'ℹ️  Test user already exists');

    // Create test repo
    const [repo, repoCreated] = await GitRepo.findOrCreate({
      where: { repoName: 'blender' },
      defaults: {
        repoName: 'blender',
        fullName: 'blender/blender',
        habitatRepoId: 'test-repo-123',
        defaultBranch: 'main',
        cutoffDate: new Date('2015-01-01'),
        isActive: true,
        fetchStatus: 'idle'
      }
    });
    console.log(repoCreated ? '✅ Test repo created' : 'ℹ️  Test repo already exists');

    // Create test commit
    const [commit, commitCreated] = await Commit.findOrCreate({
      where: {
        repoId: repo.id,
        baseCommit: 'def456ghi789jkl012mno345pqr678stu901vwx234'
      },
      defaults: {
        repoId: repo.id,
        mergedCommit: 'abc123def456ghi789jkl012mno345pqr678stu901',
        baseCommit: 'def456ghi789jkl012mno345pqr678stu901vwx234',
        branch: 'main',
        message: 'Implement robust BMesh edge dissolve rules',
        author: 'John Doe <john@example.com>',
        commitDate: new Date('2023-05-15T10:30:00Z'),
        fileChanges: 3,
        additions: 450,
        deletions: 120,
        netChange: 330,
        testAdditions: 150,
        nonTestAdditions: 300,
        habitateScore: 85,
        difficultyScore: 75.5,
        suitabilityScore: 80.0,
        hasDependencyChanges: false,
        isUnsuitable: false,
        isBehaviorPreservingRefactor: false
      }
    });
    console.log(commitCreated ? '✅ Test commit created' : 'ℹ️  Test commit already exists');

    // Create commit files
    if (commitCreated) {
      await CommitFile.bulkCreate([
        {
          commitId: commit.id,
          filePath: 'source/blender/bmesh/intern/bmesh_ops.c',
          fileName: 'bmesh_ops.c',
          fileDirectory: 'source/blender/bmesh/intern',
          additions: 300,
          deletions: 50,
          isTestFile: false,
          isDependencyFile: false,
          fileExtension: '.c'
        },
        {
          commitId: commit.id,
          filePath: 'tests/bmesh/test_bmesh_ops.py',
          fileName: 'test_bmesh_ops.py',
          fileDirectory: 'tests/bmesh',
          additions: 150,
          deletions: 70,
          isTestFile: true,
          isDependencyFile: false,
          fileExtension: '.py'
        }
      ]);
      console.log('✅ Commit files created');
    }

    // Create test account
    const [account, accountCreated] = await UserHabitatAccount.findOrCreate({
      where: {
        userId: testUser.id,
        accountName: 'test_habitat_account'
      },
      defaults: {
        userId: testUser.id,
        accountName: 'test_habitat_account',
        apiToken: 'test_token_abc123',
        apiUrl: 'https://api.habitat.com',
        reverseLimit: 7,
        remainingReversals: 5,
        accountHealth: 'healthy',
        isActive: true
      }
    });
    console.log(accountCreated ? '✅ Test account created' : 'ℹ️  Test account already exists');

    // Create test reservation
    const [reservation, reservationCreated] = await Reservation.findOrCreate({
      where: {
        userId: testUser.id,
        commitId: commit.id,
        status: 'active'
      },
      defaults: {
        userId: testUser.id,
        accountId: account.id,
        commitId: commit.id,
        habitatReservationId: 'res_test_123',
        status: 'active',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        reservedAt: new Date()
      }
    });
    console.log(reservationCreated ? '✅ Test reservation created' : 'ℹ️  Test reservation already exists');

    // Create test memo
    const [memo, memoCreated] = await MemoCommit.findOrCreate({
      where: {
        userId: testUser.id,
        commitId: commit.id
      },
      defaults: {
        userId: testUser.id,
        commitId: commit.id,
        priority: 5,
        notes: 'High priority commit for testing'
      }
    });
    console.log(memoCreated ? '✅ Test memo created' : 'ℹ️  Test memo already exists');

    // Create test successful task
    const [task, taskCreated] = await SuccessfulTask.findOrCreate({
      where: {
        userId: testUser.id,
        commitId: commit.id
      },
      defaults: {
        userId: testUser.id,
        commitId: commit.id,
        taskName: 'Implement Robust BMesh Edge Dissolve Rules',
        taskDescription: 'Implement a robust and geometry-aware edge dissolve behavior that handles complex geometry cases.',
        gitBaseCommit: 'def456ghi789jkl012mno345pqr678stu901vwx234',
        mergeCommit: 'abc123def456ghi789jkl012mno345pqr678stu901',
        goldenPatch: '--- a/source/blender/bmesh/intern/bmesh_ops.c\n+++ b/source/blender/bmesh/intern/bmesh_ops.c\n@@ -100,6 +100,8 @@\n+  // Implementation here\n+  return result;\n }',
        testPatch: '--- a/tests/bmesh/test_bmesh_ops.py\n+++ b/tests/bmesh/test_bmesh_ops.py\n@@ -1,3 +1,5 @@\n+def test_edge_dissolve__HABITAT():\n+    assert True\n }',
        basePatch: '--- a/source/blender/bmesh/intern/bmesh_ops.c\n+++ b/source/blender/bmesh/intern/bmesh_ops.c\n@@ -100,6 +100,8 @@\n }',
        prNumber: 1234,
        hints: 'Note: The swizzle accessors must return by value, not by reference.',
        aiSuccessRate: 35.5,
        payoutAmount: 1200.00,
        status: 'approved',
        approvedBy: admin.id,
        approvedAt: new Date()
      }
    });
    console.log(taskCreated ? '✅ Test successful task created' : 'ℹ️  Test successful task already exists');

    console.log('\n✅ Test data creation completed!');
    console.log('\n📝 Test Credentials:');
    console.log('Admin:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('\nUser:');
    console.log('  Username: testuser');
    console.log('  Password: password123');
    console.log('\n🔗 Test Data IDs:');
    console.log(`  Repo ID: ${repo.id}`);
    console.log(`  Commit ID: ${commit.id}`);
    console.log(`  Account ID: ${account.id}`);
    console.log(`  Reservation ID: ${reservation.id}`);

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await sequelize.close();
  }
};

createTestData();
