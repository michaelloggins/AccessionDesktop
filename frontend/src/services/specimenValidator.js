/**
 * specimenValidator — Validates specimen type and volume against compendium.
 *
 * Returns an array of { testIndex, field, message } errors.
 */

export function validateSpecimens(tests) {
  const errors = [];

  tests.forEach((test, i) => {
    // Check specimen type is selected
    if (!test.specimen_type) {
      errors.push({
        testIndex: i,
        field: "specimen_type",
        message: `Specimen type is required for ${test.name} (${test.code})`,
      });
      return; // Can't validate volume without specimen type
    }

    // Check specimen type is compatible with this test
    if (test.compatible_specimens && test.compatible_specimens.length > 0) {
      if (!test.compatible_specimens.includes(test.specimen_type)) {
        errors.push({
          testIndex: i,
          field: "specimen_type",
          message: `"${test.specimen_type}" is not a valid specimen type for ${test.name}. Valid: ${test.compatible_specimens.join(", ")}`,
        });
      }
    }

    // Check volume is provided
    if (!test.volume_ml && test.volume_ml !== 0) {
      errors.push({
        testIndex: i,
        field: "volume_ml",
        message: `Specimen volume is required for ${test.name} (${test.code})`,
      });
      return;
    }

    // Check volume meets minimum from compendium
    if (test.orderable_loincs) {
      const matchingLoinc = test.orderable_loincs.find(
        (ol) => ol.sample_type === test.specimen_type,
      );
      if (matchingLoinc && matchingLoinc.min_volume_ml) {
        if (test.volume_ml < matchingLoinc.min_volume_ml) {
          errors.push({
            testIndex: i,
            field: "volume_ml",
            message: `Volume ${test.volume_ml} mL is below minimum ${matchingLoinc.min_volume_ml} mL for ${test.name} (${test.specimen_type})`,
          });
        }
      }
    }
  });

  return errors;
}

/**
 * Validate a single order (patient + tests).
 * Returns { valid: boolean, errors: [] }
 */
export function validateOrder(order, orderType) {
  const errors = [];
  const isVet = orderType === "veterinary";

  // Patient required fields
  if (!order.patient.name) {
    errors.push({ field: "patient", message: isVet ? "Pet Name is required" : "Last Name is required" });
  }
  if (isVet && !order.patient.owner_name) {
    errors.push({ field: "patient", message: "Owner Last Name is required" });
  }
  if (isVet && !order.patient.species) {
    errors.push({ field: "patient", message: "Species is required" });
  }
  if (!isVet && !order.patient.first_name) {
    errors.push({ field: "patient", message: "First Name is required" });
  }
  if (!order.ordering.physician) {
    errors.push({ field: "ordering", message: isVet ? "Ordering Veterinarian is required" : "Ordering Physician is required" });
  }

  // Tests required
  if (!order.tests || order.tests.length === 0) {
    errors.push({ field: "tests", message: "At least one test is required" });
  }

  // Specimen validation
  const specimenErrors = validateSpecimens(order.tests || []);
  errors.push(...specimenErrors.map((e) => ({
    field: "specimen",
    message: e.message,
    testIndex: e.testIndex,
  })));

  return {
    valid: errors.length === 0,
    errors,
  };
}
