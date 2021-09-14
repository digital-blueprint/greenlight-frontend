import {Validator} from './validate.js';
export {Validator, ValidationResult} from './validate.js';


const defaultValidator = new Validator();

/**
 * FIXME: remove this function,
 * this is just a shim to provide a similar interface to the server one.
 * 
 * Use Validator/ValidationResult directly.
 *
 * @param {string} hc1 
 * @param {string} lang 
 * @returns {object}
 */
export async function hcertValidation(hc1, lang)
{
    let result = {
        status: -1,
        error: null,
        data : {
            firstname: null,
            lastname: null,
            dob: null,
            validUntil: null,
        }
    };

    let res;
    try {
        res = await defaultValidator.validate(hc1, new Date(), lang, true);
    } catch (error) {
        result.status = 500;
        result.error = error.message;
        console.log("Validation error", error);
        return result;
    }

    if (res.isValid) {
        result.status = 201;
        result.data.firstname = res.firstname;
        result.data.lastname = res.lastname;
        result.data.dob = res.dob;
        result.data.validUntil = res.validUntil;
    } else {
        result.status = 422;
        result.error = res.error;
    }

    return result;
}
