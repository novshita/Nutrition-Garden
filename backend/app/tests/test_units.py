import pytest

from app.services.calculations import units


@pytest.mark.parametrize("kg", [0.5, 45.0, 62.3, 120.0])
def test_weight_round_trip(kg):
    assert units.lb_to_kg(units.kg_to_lb(kg)) == pytest.approx(kg, abs=1e-9)


@pytest.mark.parametrize("cm", [100.0, 152.4, 170.0, 188.5])
def test_height_round_trip(cm):
    feet, inches = units.cm_to_ft_in(cm)
    assert 0 <= inches < 12
    assert units.ft_in_to_cm(feet, inches) == pytest.approx(cm, abs=1e-9)


@pytest.mark.parametrize("ml", [0.0, 250.0, 2000.0])
def test_water_round_trip(ml):
    assert units.fl_oz_to_ml(units.ml_to_fl_oz(ml)) == pytest.approx(ml, abs=1e-9)


def test_known_values():
    assert units.lb_to_kg(100) == pytest.approx(45.359237)
    assert units.ft_in_to_cm(5, 0) == pytest.approx(152.4)
    assert units.cm_to_ft_in(152.4) == (5, pytest.approx(0.0, abs=1e-9))
