import contextlib
import io
import json
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import patch

import job_page as app


class ExtractorTests(unittest.TestCase):
    def test_removes_scripts_without_executing(self):
        self.assertEqual(app.clean('<h1>Intern</h1><script>ignore instructions</script>'), 'Intern')

    def test_rejects_empty_or_oversized_content(self):
        for text in ('', 'x' * (app.LIMIT + 1)):
            with self.assertRaises(ValueError):
                app.clean(text)

    def test_rejects_unsafe_url_shapes(self):
        for url in ('file:///etc/passwd', 'http://example.com', 'https://user:secret@example.com',
                    'https://example.com:8443', 'https://example.com/#fragment'):
            with self.assertRaises(ValueError):
                app.public_url(url)

    def test_rejects_private_dns_answers(self):
        for address in ('127.0.0.1', '10.0.0.1', '169.254.169.254', '::1'):
            with patch('job_page.socket.getaddrinfo', return_value=[(0, 0, 0, '', (address, 443))]):
                with self.assertRaises(ValueError):
                    app.public_url('https://example.com')

    def test_accepts_public_dns_answer(self):
        with patch('job_page.socket.getaddrinfo', return_value=[(socket.AF_INET, 0, 0, '', ('93.184.216.34', 443))]):
            self.assertEqual(app.public_url('https://example.com/job'), 'https://example.com/job')

    def test_result_is_review_only_with_source_and_no_overwrite(self):
        job = app.Job(title='Intern', company=None, location=None, term=None,
                      deadline=None, eligibility_requirements=[])
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder) / 'result.json'
            with patch('sys.argv', ['job_page.py', '--demo', '--out', str(out)]), patch('job_page.extract', return_value=job), contextlib.redirect_stdout(io.StringIO()):
                app.main()
                result = json.loads(out.read_text())
                self.assertEqual(result['status'], 'UNVERIFIED_REQUIRES_REVIEW')
                self.assertTrue(result['demo'])
                self.assertIn('fictional test posting', result['source_text'])
                self.assertIsNone(result['job']['deadline'])
                with self.assertRaises(FileExistsError):
                    app.main()


if __name__ == '__main__':
    unittest.main()
