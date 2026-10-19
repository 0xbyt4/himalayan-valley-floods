# .venv/bin/python -m pytest data/test_build_layers.py (from the project root)

import numpy as np
import pytest
from build_layers import FRONT_REPORTS, classify, front_envelope, osm_kind


def test_classify_needs_both_height_and_width():
    # level = bed 100 + rise; reach = half width + one 30 m cell
    assert classify(105.0, 50.0, 100.0, [4.0, 6.0, 9.0], [30.0, 40.0, 60.0]) == [False, True, True]
    # low enough but too far from the river at every band
    assert classify(101.0, 200.0, 100.0, [4.0, 6.0, 9.0], [30.0, 40.0, 60.0]) == [False, False, False]
    # close but too high
    assert classify(120.0, 10.0, 100.0, [4.0, 6.0, 9.0], [30.0, 40.0, 60.0]) == [False, False, False]


def test_classify_is_monotone_in_the_band():
    r = classify(107.0, 70.0, 100.0, [5.0, 7.5, 12.0], [20.0, 45.0, 80.0])
    assert r == sorted(r)  # a point reached at a lower band is reached at every higher band


@pytest.mark.parametrize(
    ("tags", "kind"),
    [
        ({"building": "yes"}, "building"),
        ({"highway": "footway", "bridge": "yes"}, "bridge"),
        ({"man_made": "bridge"}, "bridge"),
        ({"power": "plant", "plant:source": "hydro"}, "power"),
        ({"waterway": "weir"}, "dam"),
        ({"amenity": "school"}, "school"),
        ({"healthcare": "clinic"}, "health"),
        ({"highway": "primary"}, "road"),
        ({"highway": "track"}, None),
        # a facility drawn as a building is the facility
        ({"building": "yes", "amenity": "school"}, "school"),
        ({"building": "yes", "power": "plant"}, "power"),
        ({"building": "hospital", "amenity": "hospital"}, "health"),
    ],
)
def test_osm_kind(tags, kind):
    assert osm_kind(tags) == kind


def test_front_envelope_is_monotone_and_bounded():
    km, lo, hi = front_envelope(FRONT_REPORTS)
    assert lo == sorted(lo) and hi == sorted(hi)
    assert all(a <= b for a, b in zip(lo, hi, strict=True))
    # each envelope bound stays within the earliest and latest reported times at or below that place
    for i in range(len(km)):
        assert lo[i] >= FRONT_REPORTS[i][1]
        assert hi[i] <= max(FRONT_REPORTS[i][2], lo[i])


def test_front_envelope_example():
    _, lo, hi = front_envelope([(0, 10, 10, "", "", []), (1, 5, 30, "", "", []), (2, 20, 25, "", "", [])])
    assert lo == [10, 10, 20] and hi == [10, 25, 25]


def test_heights_round_trip():
    # the app's terrain encoding keeps every height to half a step, with steep and flat ground and both signs
    from build_app import HEIGHT_STEP, decode_heights, encode_heights

    rng = np.random.default_rng(7)
    h = (np.cumsum(rng.normal(0, 40, (37, 53)), axis=1) + np.linspace(-200, 6000, 37)[:, None]).astype(np.float32)
    back = decode_heights(encode_heights(h), *h.shape)
    assert back.shape == h.shape
    assert np.abs(back - h).max() <= HEIGHT_STEP / 2 + 1e-3
