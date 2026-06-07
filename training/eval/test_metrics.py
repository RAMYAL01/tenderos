"""
Self-test for the TenderEval metrics (pure, no ML deps / no model endpoint).
Runs in CI on every change so the eval harness can't silently rot.

Run: python -m unittest eval.test_metrics -v
"""

import unittest

from eval import metrics as M


class TestMetrics(unittest.TestCase):
    def test_extraction_f1_unit_alias(self):
        gold = [{"item_code": "2.1.4", "description": "RC slab", "unit_of_measurement": "m3", "quantity": 1250}]
        pred = [{"item_code": "2.1.4", "description": "RC slab", "unit_of_measurement": "cum", "quantity": 1250}]
        self.assertEqual(M.extraction_f1(pred, gold), 1.0)  # cum -> m3 alias

    def test_quantity_exact_match_arabic_digits(self):
        gold = [{"item_code": "4-1", "description": "x", "unit_of_measurement": "m3", "quantity": 1250}]
        pred = [{"item_code": "4-1", "description": "x", "unit_of_measurement": "م3", "quantity": "١٢٥٠"}]
        self.assertEqual(M.quantity_exact_match(pred, gold), 1.0)

    def test_fabrication_rate(self):
        gold = [{"item_code": "A", "description": "x", "unit_of_measurement": "no"}]
        pred = [
            {"item_code": "A", "description": "x", "unit_of_measurement": "no"},
            {"item_code": "GHOST", "description": "made up", "unit_of_measurement": "no"},
        ]
        self.assertAlmostEqual(M.fabrication_rate(pred, gold), 0.5)

    def test_label_accuracy(self):
        self.assertEqual(M.label_accuracy(["PARTIAL", "GAP"], ["PARTIAL", "COMPLIANT"]), 0.5)

    def test_high_risk_recall_catches_showstoppers(self):
        # Missing one HIGH-risk item => recall 0.5
        self.assertEqual(M.recall_for_label(["HIGH", "LOW"], ["HIGH", "HIGH"], "HIGH"), 0.5)
        # All caught => 1.0
        self.assertEqual(M.recall_for_label(["HIGH", "HIGH"], ["HIGH", "HIGH"], "HIGH"), 1.0)

    def test_cross_language_consistency(self):
        en = [{"item_code": "2.1.4", "description": "slab"}]
        ar = [{"item_code": "2.1.4", "description": "بلاطة"}]
        self.assertEqual(M.cross_language_consistency([(en, ar)]), 1.0)

    def test_empty_sets_are_perfect(self):
        self.assertEqual(M.extraction_f1([], []), 1.0)
        self.assertEqual(M.fabrication_rate([], []), 0.0)


if __name__ == "__main__":
    unittest.main()
