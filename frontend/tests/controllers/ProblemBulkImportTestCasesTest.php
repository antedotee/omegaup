<?php
/**
 * Tests for apiBulkImportTestCases in ProblemController
 */

class ProblemBulkImportTestCasesTest extends \OmegaUp\Test\ControllerTestCase {
    public function setUp(): void {
        parent::setUp();

        // Get File Uploader Mock and tell Omegaup API to use it
        \OmegaUp\FileHandler::setFileUploaderForTesting(
            $this->createFileUploaderMock()
        );
    }

    /**
     * Test bulk import with valid file pairs
     */
    public function testBulkImportValidFiles() {
        // Create a problem
        $problemData = \OmegaUp\Test\Factories\Problem::getRequest();
        $r = $problemData['request'];
        $problemAuthor = $problemData['author'];

        // Login user
        $login = self::login($problemAuthor);
        $r['auth_token'] = $login->auth_token;

        // Call the API to create problem
        $response = \OmegaUp\Controllers\Problem::apiCreate($r);
        $this->assertSame('ok', $response['status']);

        $problem = \OmegaUp\DAO\Problems::getByAlias($r['problem_alias']);
        $this->assertNotNull($problem);
        $this->assertNotNull($problem->alias);

        // Create temporary test case files
        $tempDir = sys_get_temp_dir();
        $inputFile1 = tempnam($tempDir, 'test_input1');
        $outputFile1 = tempnam($tempDir, 'test_output1');
        $inputFile2 = tempnam($tempDir, 'test_input2');
        $outputFile2 = tempnam($tempDir, 'test_output2');

        file_put_contents($inputFile1, "5\n1 2 3 4 5\n");
        file_put_contents($outputFile1, "15\n");
        file_put_contents($inputFile2, "3\n10 20 30\n");
        file_put_contents($outputFile2, "60\n");

        // Simulate file upload
        $_FILES['test_case_files'] = [
            'name' => [
                'case1.in',
                'case1.out',
                'case2.in',
                'case2.out',
            ],
            'type' => [
                'text/plain',
                'text/plain',
                'text/plain',
                'text/plain',
            ],
            'tmp_name' => [
                $inputFile1,
                $outputFile1,
                $inputFile2,
                $outputFile2,
            ],
            'error' => [
                UPLOAD_ERR_OK,
                UPLOAD_ERR_OK,
                UPLOAD_ERR_OK,
                UPLOAD_ERR_OK,
            ],
            'size' => [
                filesize($inputFile1),
                filesize($outputFile1),
                filesize($inputFile2),
                filesize($outputFile2),
            ],
        ];

        // Call bulk import API
        $bulkImportRequest = new \OmegaUp\Request([
            'auth_token' => $login->auth_token,
            'problem_alias' => $problem->alias,
            'message' => 'Bulk import test cases',
        ]);

        $bulkImportResponse = \OmegaUp\Controllers\Problem::apiBulkImportTestCases(
            $bulkImportRequest
        );

        // Verify response
        $this->assertSame('ok', $bulkImportResponse['status']);
        $this->assertSame(2, $bulkImportResponse['imported_count']);
        $this->assertEmpty($bulkImportResponse['errors']);

        // Clean up temp files
        @unlink($inputFile1);
        @unlink($outputFile1);
        @unlink($inputFile2);
        @unlink($outputFile2);
    }

    /**
     * Test bulk import with unmatched files
     */
    public function testBulkImportUnmatchedFiles() {
        // Create a problem
        $problemData = \OmegaUp\Test\Factories\Problem::getRequest();
        $r = $problemData['request'];
        $problemAuthor = $problemData['author'];

        // Login user
        $login = self::login($problemAuthor);
        $r['auth_token'] = $login->auth_token;

        // Call the API to create problem
        $response = \OmegaUp\Controllers\Problem::apiCreate($r);
        $this->assertSame('ok', $response['status']);

        $problem = \OmegaUp\DAO\Problems::getByAlias($r['problem_alias']);
        $this->assertNotNull($problem);
        $this->assertNotNull($problem->alias);

        // Create temporary test case files with unmatched pair
        $tempDir = sys_get_temp_dir();
        $inputFile1 = tempnam($tempDir, 'test_input1');
        $outputFile1 = tempnam($tempDir, 'test_output1');
        $inputFile2 = tempnam($tempDir, 'test_input2');
        // Missing output file for input2

        file_put_contents($inputFile1, "5\n1 2 3 4 5\n");
        file_put_contents($outputFile1, "15\n");
        file_put_contents($inputFile2, "3\n10 20 30\n");

        // Simulate file upload
        $_FILES['test_case_files'] = [
            'name' => [
                'case1.in',
                'case1.out',
                'case2.in',
            ],
            'type' => [
                'text/plain',
                'text/plain',
                'text/plain',
            ],
            'tmp_name' => [
                $inputFile1,
                $outputFile1,
                $inputFile2,
            ],
            'error' => [
                UPLOAD_ERR_OK,
                UPLOAD_ERR_OK,
                UPLOAD_ERR_OK,
            ],
            'size' => [
                filesize($inputFile1),
                filesize($outputFile1),
                filesize($inputFile2),
            ],
        ];

        // Call bulk import API
        $bulkImportRequest = new \OmegaUp\Request([
            'auth_token' => $login->auth_token,
            'problem_alias' => $problem->alias,
            'message' => 'Bulk import test cases',
        ]);

        try {
            $bulkImportResponse = \OmegaUp\Controllers\Problem::apiBulkImportTestCases(
                $bulkImportRequest
            );
            // Should have imported case1 and reported error for case2
            $this->assertSame('ok', $bulkImportResponse['status']);
            $this->assertSame(1, $bulkImportResponse['imported_count']);
            $this->assertNotEmpty($bulkImportResponse['errors']);
        } catch (\OmegaUp\Exceptions\InvalidParameterException $e) {
            // If no matched pairs, should throw exception
            $this->assertStringContainsString('noMatchedPairs', $e->getMessage());
        }

        // Clean up temp files
        @unlink($inputFile1);
        @unlink($outputFile1);
        @unlink($inputFile2);
    }

    /**
     * Test bulk import with no files
     */
    public function testBulkImportNoFiles() {
        // Create a problem
        $problemData = \OmegaUp\Test\Factories\Problem::getRequest();
        $r = $problemData['request'];
        $problemAuthor = $problemData['author'];

        // Login user
        $login = self::login($problemAuthor);
        $r['auth_token'] = $login->auth_token;

        // Call the API to create problem
        $response = \OmegaUp\Controllers\Problem::apiCreate($r);
        $this->assertSame('ok', $response['status']);

        $problem = \OmegaUp\DAO\Problems::getByAlias($r['problem_alias']);
        $this->assertNotNull($problem);
        $this->assertNotNull($problem->alias);

        // Don't set $_FILES

        // Call bulk import API
        $bulkImportRequest = new \OmegaUp\Request([
            'auth_token' => $login->auth_token,
            'problem_alias' => $problem->alias,
            'message' => 'Bulk import test cases',
        ]);

        try {
            \OmegaUp\Controllers\Problem::apiBulkImportTestCases(
                $bulkImportRequest
            );
            $this->fail('Should have thrown InvalidParameterException');
        } catch (\OmegaUp\Exceptions\InvalidParameterException $e) {
            $this->assertStringContainsString('parameterEmpty', $e->getMessage());
        }
    }

    /**
     * Test bulk import with unauthorized user
     */
    public function testBulkImportUnauthorized() {
        // Create a problem
        $problemData = \OmegaUp\Test\Factories\Problem::getRequest();
        $r = $problemData['request'];
        $problemAuthor = $problemData['author'];

        // Login user
        $login = self::login($problemAuthor);
        $r['auth_token'] = $login->auth_token;

        // Call the API to create problem
        $response = \OmegaUp\Controllers\Problem::apiCreate($r);
        $this->assertSame('ok', $response['status']);

        $problem = \OmegaUp\DAO\Problems::getByAlias($r['problem_alias']);
        $this->assertNotNull($problem);
        $this->assertNotNull($problem->alias);

        // Create another user
        ['identity' => $otherIdentity] = \OmegaUp\Test\Factories\User::createUser();

        // Create temporary test case files
        $tempDir = sys_get_temp_dir();
        $inputFile1 = tempnam($tempDir, 'test_input1');
        $outputFile1 = tempnam($tempDir, 'test_output1');

        file_put_contents($inputFile1, "5\n1 2 3 4 5\n");
        file_put_contents($outputFile1, "15\n");

        // Simulate file upload
        $_FILES['test_case_files'] = [
            'name' => ['case1.in', 'case1.out'],
            'type' => ['text/plain', 'text/plain'],
            'tmp_name' => [$inputFile1, $outputFile1],
            'error' => [UPLOAD_ERR_OK, UPLOAD_ERR_OK],
            'size' => [filesize($inputFile1), filesize($outputFile1)],
        ];

        // Login as other user
        $otherLogin = self::login($otherIdentity);

        // Call bulk import API as unauthorized user
        $bulkImportRequest = new \OmegaUp\Request([
            'auth_token' => $otherLogin->auth_token,
            'problem_alias' => $problem->alias,
            'message' => 'Bulk import test cases',
        ]);

        try {
            \OmegaUp\Controllers\Problem::apiBulkImportTestCases(
                $bulkImportRequest
            );
            $this->fail('Should have thrown ForbiddenAccessException');
        } catch (\OmegaUp\Exceptions\ForbiddenAccessException $e) {
            $this->assertStringContainsString('userNotAllowed', $e->getMessage());
        }

        // Clean up temp files
        @unlink($inputFile1);
        @unlink($outputFile1);
    }
}
